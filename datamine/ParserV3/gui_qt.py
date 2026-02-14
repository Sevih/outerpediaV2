"""
ParserV3 GUI - PyQt6 Edition
Modern GUI with Binary Explorer tab

Features:
- Character extraction by ID
- Binary file explorer (.bytes viewer)
- Manual field editing
- JSON comparison
- Export management

Author: ParserV3
Date: 2025-10
"""

from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QTabWidget,
    QPushButton, QLabel, QComboBox, QLineEdit, QTextEdit, QTextBrowser,
    QMessageBox, QSplitter, QTreeView, QTableWidget, QTableWidgetItem,
    QSpinBox, QGroupBox, QFormLayout, QHeaderView, QAbstractItemView,
    QApplication, QCompleter, QScrollArea, QCheckBox, QProgressDialog, QDialog
)
from PyQt6.QtGui import QFileSystemModel, QAction, QPixmap, QIcon
from PyQt6.QtCore import Qt, QThread, pyqtSignal, QProcess
from pathlib import Path
from typing import Dict
import json
import logging
import shutil
import os

from character_extractor import CharacterExtractor
from cache_manager import CacheManager
from json_comparator import JSONComparator
from text_utils import to_kebab_case
from export_manager import ExportManager
from bytes_parser import Bytes_parser
from export_dialogs_qt import MetadataInputDialog
from asset_manager import AssetManager
from profile_manager import ProfileManager
from ee_manager import EEManager
from ee_dialog import EEBuffDebuffDialog
from buff_validator import BuffValidator
from localization_extractor import LocalizationExtractor
from boss_finder import BossFinder
from boss_finder_v2 import BossFinderV2
from fusion_extractor import FusionExtractor

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# No longer using QThread - using QProcess instead
# ─────────────────────────────────────────────────────────────────────────────


from config import (
    BYTES_FOLDER, DATAMINE_ROOT, PROJECT_ROOT, EXTRACTED_ASSETS,
    CHAR_DATA, BOSS_DATA, DATA_ROOT, PUBLIC_IMAGES, PUBLIC_CHARACTERS,
    BUFFS_FILE, DEBUFFS_FILE, EE_FILE, EQUIPMENT_DATA,
)

# Data paths
CHAR_DATA_FOLDER = CHAR_DATA
BOSS_DATA_FOLDER = BOSS_DATA

# Audio paths
BGM_OUTPUT_FOLDER = PROJECT_ROOT / "public" / "audio" / "AudioClip"
BGM_MAPPING_FOLDER = DATA_ROOT

# Image paths
SPRITE_SOURCE_FOLDER = EXTRACTED_ASSETS / "assets" / "editor" / "resources" / "sprite"
BOSS_SKILL_IMAGE_FOLDER = PUBLIC_IMAGES / "characters" / "boss" / "skill"
BOSS_PORTRAIT_IMAGE_FOLDER = PUBLIC_IMAGES / "characters" / "boss" / "portrait"
BOSS_MINI_IMAGE_FOLDER = PUBLIC_IMAGES / "characters" / "boss" / "mini"

# Validate paths on startup
if not CHAR_DATA_FOLDER.exists():
    logger.warning(f"CHAR_DATA_FOLDER does not exist: {CHAR_DATA_FOLDER.absolute()}")
    logger.warning(f"PROJECT_ROOT: {PROJECT_ROOT.absolute()}")


class BinaryExplorerTab(QWidget):
    """Tab for exploring .bytes binary files"""

    def __init__(self):
        super().__init__()
        self.current_data = []  # Store loaded data for filtering
        self.current_columns = []  # Store column names
        self.current_file_path = None  # Store current file path for reloading
        self._setup_ui()

    def _setup_ui(self):
        """Setup the Binary Explorer UI"""
        layout = QVBoxLayout(self)

        # Path bar
        path_layout = QHBoxLayout()
        path_layout.addWidget(QLabel("Path:"))
        self.path_edit = QLineEdit(str(BYTES_FOLDER))
        path_layout.addWidget(self.path_edit)

        refresh_btn = QPushButton("Refresh")
        refresh_btn.clicked.connect(self._refresh)
        path_layout.addWidget(refresh_btn)

        layout.addLayout(path_layout)

        # Search bar and format selector
        search_layout = QHBoxLayout()
        search_layout.addWidget(QLabel("Search:"))
        self.search_edit = QLineEdit()
        self.search_edit.setPlaceholderText("Search in table data...")
        self.search_edit.textChanged.connect(self._on_search_changed)
        search_layout.addWidget(self.search_edit)

        clear_search_btn = QPushButton("Clear")
        clear_search_btn.clicked.connect(lambda: self.search_edit.clear())
        search_layout.addWidget(clear_search_btn)

        # Separator format selector
        search_layout.addWidget(QLabel("Format:"))
        self.format_combo = QComboBox()
        self.format_combo.addItems(["Auto", "7-null (new)", "4-null (legacy)"])
        self.format_combo.setCurrentIndex(0)
        self.format_combo.currentIndexChanged.connect(self._on_format_changed)
        self.format_combo.setToolTip("Choose binary separator format:\n"
                                      "- Auto: Detect automatically\n"
                                      "- 7-null: New format (7 null bytes)\n"
                                      "- 4-null: Legacy format (4 null bytes)")
        search_layout.addWidget(self.format_combo)

        layout.addLayout(search_layout)

        # Splitter for tree and preview
        splitter = QSplitter(Qt.Orientation.Horizontal)

        # File tree
        self.file_model = QFileSystemModel()
        self.file_model.setRootPath(str(BYTES_FOLDER))
        self.file_model.setNameFilters(["*.bytes"])
        self.file_model.setNameFilterDisables(False)

        self.tree_view = QTreeView()
        self.tree_view.setModel(self.file_model)
        self.tree_view.setRootIndex(self.file_model.index(str(BYTES_FOLDER)))
        self.tree_view.setColumnWidth(0, 300)
        self.tree_view.clicked.connect(self._on_file_selected)

        splitter.addWidget(self.tree_view)

        # Right panel: table + JSON preview (vertical splitter)
        right_splitter = QSplitter(Qt.Orientation.Vertical)

        # Table view for data
        self.table_widget = QTableWidget()
        self.table_widget.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.table_widget.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.table_widget.setAlternatingRowColors(True)
        self.table_widget.horizontalHeader().setStretchLastSection(True)
        self.table_widget.itemSelectionChanged.connect(self._on_row_selected)

        right_splitter.addWidget(self.table_widget)

        # JSON preview for selected row
        json_panel = QWidget()
        json_layout = QVBoxLayout(json_panel)
        json_layout.setContentsMargins(0, 0, 0, 0)

        # Header with info label and localization option
        json_header = QHBoxLayout()
        self.info_label = QLabel("Select a .bytes file to preview")
        json_header.addWidget(self.info_label)
        json_header.addStretch()

        # Localization rename option
        self.localize_checkbox = QCheckBox("Localize keys:")
        self.localize_checkbox.setToolTip("Rename language columns (English→base, Japanese→_jp, Korean→_kr, Chinese→_zh)")
        self.localize_checkbox.stateChanged.connect(self._on_row_selected)
        json_header.addWidget(self.localize_checkbox)

        self.localize_key_edit = QLineEdit("name")
        self.localize_key_edit.setFixedWidth(100)
        self.localize_key_edit.setPlaceholderText("key name")
        self.localize_key_edit.setToolTip("Base key name for localized fields")
        self.localize_key_edit.textChanged.connect(self._on_row_selected)
        json_header.addWidget(self.localize_key_edit)

        json_layout.addLayout(json_header)

        self.row_json_text = QTextEdit()
        self.row_json_text.setReadOnly(True)
        self.row_json_text.setFontFamily("Courier New")
        self.row_json_text.setPlaceholderText("Select a row to view JSON...")
        json_layout.addWidget(self.row_json_text)

        right_splitter.addWidget(json_panel)
        right_splitter.setSizes([400, 200])

        splitter.addWidget(right_splitter)

        splitter.setSizes([300, 900])
        layout.addWidget(splitter)

    def _refresh(self):
        """Refresh the file tree"""
        path = self.path_edit.text()
        if Path(path).exists():
            self.file_model.setRootPath(path)
            self.tree_view.setRootIndex(self.file_model.index(path))
            logger.info(f"Refreshed explorer at: {path}")
            self.info_label.setText(f"Refreshed: {path}")
        else:
            logger.warning(f"Path does not exist: {path}")
            QMessageBox.warning(self, "Invalid Path", f"Path does not exist: {path}")

    def _on_file_selected(self, index):
        """Handle file selection"""
        file_path = Path(self.file_model.filePath(index))

        if file_path.is_file() and file_path.suffix == ".bytes":
            self._preview_bytes_file(file_path)
        else:
            self.table_widget.clear()
            self.table_widget.setRowCount(0)
            self.table_widget.setColumnCount(0)
            if file_path.is_dir():
                self.info_label.setText(f"Directory: {file_path.name}")
            else:
                self.info_label.setText(f"Selected: {file_path.name}")

    def _sort_columns(self, columns: list) -> list:
        """Sort language columns in preferred order"""
        lang_order = ['english', 'japanese', 'korean', 'china_simplified', 'china_traditional']

        # Find language columns
        lang_cols = {}
        for idx, col in enumerate(columns):
            col_lower = col.lower()
            if col_lower in lang_order:
                lang_cols[idx] = col

        if not lang_cols:
            return columns

        # Get present language columns
        present_langs = [col for col in columns if col.lower() in lang_order]

        # Sort them
        sorted_langs = sorted(present_langs, key=lambda x: lang_order.index(x.lower()))

        # Rebuild list
        result = list(columns)
        positions = sorted(lang_cols.keys())

        for pos, new_col in zip(positions, sorted_langs):
            result[pos] = new_col

        return result

    def _preview_bytes_file(self, file_path: Path):
        """Preview a .bytes file in table format"""
        try:
            file_size_kb = file_path.stat().st_size // 1024
            self.info_label.setText(f"Loading: {file_path.name} ({file_size_kb} KB)...")
            QApplication.processEvents()

            logger.info(f"Loading: {file_path.name} ({file_size_kb} KB)")

            # Store current file path for reloading
            self.current_file_path = file_path

            # Get separator mode from combo box
            separator_mode = self._get_separator_mode()

            # Use ParserV3 bytes_parser with selected separator mode
            parser = Bytes_parser(str(file_path), separator_mode=separator_mode)
            data = parser.get_data()

            if not data:
                self.table_widget.clear()
                self.table_widget.setRowCount(0)
                self.table_widget.setColumnCount(0)
                logger.warning(f"No data in {file_path.name}")
                self.info_label.setText(f"No data found in {file_path.name}")
                return

            # Get columns
            columns_dict = parser.get_columns()
            original_columns = [columns_dict[idx] for idx in sorted(columns_dict.keys())]

            # Sort language columns
            sorted_columns = self._sort_columns(original_columns)

            # Filter out empty columns (where all values are empty)
            non_empty_columns = []
            for col_name in sorted_columns:
                has_content = False
                for row_data in data:
                    value = row_data.get(col_name, "")
                    if value and str(value).strip():
                        has_content = True
                        break
                if has_content:
                    non_empty_columns.append(col_name)

            # Store data for filtering
            self.current_data = data
            self.current_columns = non_empty_columns
            self.current_file_name = file_path.name
            self.all_columns_count = len(sorted_columns)

            # Populate table with all data
            self._populate_table(data, non_empty_columns)

            hidden_count = len(sorted_columns) - len(non_empty_columns)
            logger.info(f"Loaded {len(data)} rows × {len(non_empty_columns)} columns from {file_path.name} ({hidden_count} empty columns hidden)")
            self.info_label.setText(f"Loaded: {file_path.name} - {len(data)} rows × {len(non_empty_columns)} columns ({hidden_count} empty hidden)")

        except Exception as e:
            logger.exception("Error loading file")
            self.table_widget.clear()
            self.table_widget.setRowCount(0)
            self.table_widget.setColumnCount(0)
            self.info_label.setText(f"Error loading {file_path.name}")
            QMessageBox.critical(self, "Error", f"Failed to load file:\n{str(e)}")

    def _populate_table(self, data, columns):
        """Populate table with given data and columns"""
        # Setup table
        self.table_widget.clear()
        self.table_widget.setRowCount(len(data))
        self.table_widget.setColumnCount(len(columns))
        self.table_widget.setHorizontalHeaderLabels(columns)

        # Populate table and calculate max widths
        col_max_widths = {}
        for row_idx, row_data in enumerate(data):
            for col_idx, col_name in enumerate(columns):
                value = row_data.get(col_name, "")
                value_str = str(value)
                item = QTableWidgetItem(value_str)
                self.table_widget.setItem(row_idx, col_idx, item)

                # Track max length for this column
                if col_idx not in col_max_widths:
                    col_max_widths[col_idx] = len(col_name)  # Start with header length
                col_max_widths[col_idx] = max(col_max_widths[col_idx], len(value_str))

        # Set column widths based on content, with 400px max
        self.table_widget.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Interactive)
        for col_idx in range(len(columns)):
            # Estimate width: ~8 pixels per character + 20px padding
            estimated_width = min(col_max_widths.get(col_idx, 50) * 8 + 20, 400)
            # Minimum width of 50px for readability
            final_width = max(estimated_width, 50)
            self.table_widget.setColumnWidth(col_idx, final_width)

    def _get_separator_mode(self) -> str:
        """Get separator mode from combo box selection"""
        index = self.format_combo.currentIndex()
        if index == 0:
            return "auto"
        elif index == 1:
            return "7-null"
        elif index == 2:
            return "4-null"
        return "auto"

    def _on_format_changed(self, index):
        """Handle format selection change - reload current file"""
        if self.current_file_path:
            logger.info(f"Format changed, reloading {self.current_file_path.name}")
            self._preview_bytes_file(self.current_file_path)

    def _on_search_changed(self, search_text):
        """Filter table based on search text"""
        if not self.current_data:
            return

        search_text = search_text.lower().strip()

        if not search_text:
            # No search, show all data
            self._populate_table(self.current_data, self.current_columns)
            hidden_count = self.all_columns_count - len(self.current_columns)
            self.info_label.setText(
                f"Loaded: {self.current_file_name} - {len(self.current_data)} rows × "
                f"{len(self.current_columns)} columns ({hidden_count} empty hidden)"
            )
            return

        # Filter data: search in all column values
        filtered_data = []
        for row_data in self.current_data:
            # Check if search text appears in any column value
            match_found = False
            for col_name in self.current_columns:
                value = str(row_data.get(col_name, "")).lower()
                if search_text in value:
                    match_found = True
                    break

            if match_found:
                filtered_data.append(row_data)

        # Populate with filtered data
        self._populate_table(filtered_data, self.current_columns)

        # Update status
        hidden_count = self.all_columns_count - len(self.current_columns)
        self.info_label.setText(
            f"Search: '{search_text}' - {len(filtered_data)}/{len(self.current_data)} rows × "
            f"{len(self.current_columns)} columns ({hidden_count} empty hidden)"
        )

    # Mapping for language column renaming
    LANG_COLUMN_MAP = {
        'english': '',
        'japanese': '_jp',
        'korean': '_kr',
        'china_simplified': '_zh',
        'china_traditional': '_zh',
    }

    def _on_row_selected(self):
        """Display selected row as JSON"""
        selected_rows = self.table_widget.selectionModel().selectedRows()
        if not selected_rows:
            self.row_json_text.clear()
            return

        row_idx = selected_rows[0].row()

        # Check if localization renaming is enabled
        localize = self.localize_checkbox.isChecked()
        base_key = self.localize_key_edit.text().strip() or "name"

        # Build dict from table row using current columns
        row_data = {}
        for col_idx, col_name in enumerate(self.current_columns):
            item = self.table_widget.item(row_idx, col_idx)
            if item:
                value = item.text()
                # Try to convert to int/float if possible
                if value:
                    try:
                        if '.' in value:
                            value = float(value)
                        else:
                            value = int(value)
                    except ValueError:
                        pass  # Keep as string

                # Determine the key name
                col_lower = col_name.lower()
                if localize and col_lower in self.LANG_COLUMN_MAP:
                    suffix = self.LANG_COLUMN_MAP[col_lower]
                    key = f"{base_key}{suffix}"
                else:
                    key = col_name

                row_data[key] = value

        # Display as formatted JSON
        import json
        json_str = json.dumps(row_data, indent=2, ensure_ascii=False)
        self.row_json_text.setText(json_str)


class CharacterTab(QWidget):
    """Tab for character extraction and editing"""

    # Valid values for manual fields
    VALID_ROLES = ["dps", "support", "sustain"]
    VALID_RANKS = ["S", "A", "B", "C", "D"]

    def __init__(self):
        super().__init__()
        self.current_data = None
        self.current_char_id = None
        self.existing_data = None
        self.extracted_data = None  # Raw extraction before manual field merge
        self.diff_data = None
        self.export_manager = ExportManager()
        self.extraction_process = None  # For asset extraction QProcess
        self.progress_dialog = None  # For extraction progress dialog
        self.extraction_output_dir = None  # Store output dir for completion message
        self.extraction_max_tasks = None  # Store max tasks for completion message

        self._setup_ui()
        self._load_character_list()

    def _setup_ui(self):
        """Setup the Character tab UI"""
        # Main vertical layout to put status bar at bottom
        container_layout = QVBoxLayout(self)

        main_layout = QHBoxLayout()

        # Left panel: Input and manual fields
        left_panel = QWidget()
        left_layout = QVBoxLayout(left_panel)
        left_layout.setAlignment(Qt.AlignmentFlag.AlignTop)

        # Character selection group
        select_group = QGroupBox("Extract Character")
        select_layout = QFormLayout()

        self.char_combo = QComboBox()
        self.char_combo.setEditable(True)  # Allow typing to search
        self.char_combo.setInsertPolicy(QComboBox.InsertPolicy.NoInsert)  # Don't insert typed text
        self.char_combo.setMaxVisibleItems(20)  # Limit dropdown height to 20 items

        # Add autocomplete with filter
        completer = QCompleter()
        completer.setCaseSensitivity(Qt.CaseSensitivity.CaseInsensitive)
        completer.setCompletionMode(QCompleter.CompletionMode.PopupCompletion)
        completer.setFilterMode(Qt.MatchFlag.MatchContains)
        self.char_combo.setCompleter(completer)

        # Show dropdown on click even when editable
        def show_popup_on_click():
            self.char_combo.showPopup()
        self.char_combo.lineEdit().installEventFilter(self)

        select_layout.addRow("Character:", self.char_combo)

        self.extract_btn = QPushButton("Extract")
        self.extract_btn.clicked.connect(self._extract_character)
        select_layout.addRow(self.extract_btn)

        self.compare_btn = QPushButton("Compare with Existing")
        self.compare_btn.setEnabled(False)
        self.compare_btn.clicked.connect(self._compare_with_existing)
        select_layout.addRow(self.compare_btn)

        select_group.setLayout(select_layout)
        left_layout.addWidget(select_group)

        # Character info
        self.char_info_label = QLabel("No character loaded")
        self.char_info_label.setWordWrap(True)
        left_layout.addWidget(self.char_info_label)

        # Manual fields group
        manual_group = QGroupBox("Manual Fields")
        manual_layout = QFormLayout()

        # Role
        self.role_combo = QComboBox()
        self.role_combo.addItems([""] + self.VALID_ROLES)
        manual_layout.addRow("Role *:", self.role_combo)

        # Rank
        self.rank_combo = QComboBox()
        self.rank_combo.addItems([""] + self.VALID_RANKS)
        manual_layout.addRow("Rank (PVE):", self.rank_combo)

        # Rank PVP
        self.rank_pvp_combo = QComboBox()
        self.rank_pvp_combo.addItems([""] + self.VALID_RANKS)
        manual_layout.addRow("Rank (PVP):", self.rank_pvp_combo)

        # Free checkbox
        self.free_checkbox = QCheckBox("Free character")
        manual_layout.addRow("Free:", self.free_checkbox)

        # Video
        self.video_edit = QLineEdit()
        manual_layout.addRow("Video (YouTube):", self.video_edit)

        # Skill priorities
        prio_widget = QWidget()
        prio_layout = QVBoxLayout(prio_widget)
        prio_layout.setContentsMargins(0, 0, 0, 0)

        first_layout = QHBoxLayout()
        first_layout.addWidget(QLabel("First:"))
        self.prio_first = QSpinBox()
        self.prio_first.setRange(1, 3)
        self.prio_first.setValue(1)
        first_layout.addWidget(self.prio_first)
        first_layout.addStretch()
        prio_layout.addLayout(first_layout)

        second_layout = QHBoxLayout()
        second_layout.addWidget(QLabel("Second:"))
        self.prio_second = QSpinBox()
        self.prio_second.setRange(1, 3)
        self.prio_second.setValue(2)
        second_layout.addWidget(self.prio_second)
        second_layout.addStretch()
        prio_layout.addLayout(second_layout)

        ult_layout = QHBoxLayout()
        ult_layout.addWidget(QLabel("Ultimate:"))
        self.prio_ult = QSpinBox()
        self.prio_ult.setRange(1, 3)
        self.prio_ult.setValue(3)
        ult_layout.addWidget(self.prio_ult)
        ult_layout.addStretch()
        prio_layout.addLayout(ult_layout)

        manual_layout.addRow("Skill Priority:", prio_widget)

        # Connect fields to auto-update current_data
        self.role_combo.currentTextChanged.connect(self._on_manual_field_changed)
        self.rank_combo.currentTextChanged.connect(self._on_manual_field_changed)
        self.rank_pvp_combo.currentTextChanged.connect(self._on_manual_field_changed)
        self.free_checkbox.stateChanged.connect(self._on_manual_field_changed)
        self.video_edit.textChanged.connect(self._on_manual_field_changed)
        self.prio_first.valueChanged.connect(self._on_manual_field_changed)
        self.prio_second.valueChanged.connect(self._on_manual_field_changed)
        self.prio_ult.valueChanged.connect(self._on_manual_field_changed)

        # Save button
        self.replace_live_btn = QPushButton("Replace Live File")
        self.replace_live_btn.setEnabled(False)
        self.replace_live_btn.clicked.connect(self._replace_live_file)
        manual_layout.addRow(self.replace_live_btn)

        manual_group.setLayout(manual_layout)
        left_layout.addWidget(manual_group)

        # Add stretch to push everything to top
        left_layout.addStretch()

        main_layout.addWidget(left_panel, 1)

        # Right side: Splitter for JSON and Assets
        right_splitter = QSplitter(Qt.Orientation.Horizontal)

        # JSON preview panel
        json_panel = QWidget()
        json_layout = QVBoxLayout(json_panel)
        json_layout.addWidget(QLabel("JSON Preview:"))
        self.json_text = QTextEdit()
        self.json_text.setReadOnly(True)
        self.json_text.setFontFamily("Courier New")
        self.json_text.setFontPointSize(9)
        json_layout.addWidget(self.json_text)
        right_splitter.addWidget(json_panel)

        # Assets preview panel
        assets_panel = QWidget()
        assets_layout = QVBoxLayout(assets_panel)
        assets_layout.addWidget(QLabel("Assets Preview:"))

        # Scroll area for assets
        assets_scroll = QScrollArea()
        assets_scroll.setWidgetResizable(True)
        assets_scroll.setMinimumWidth(250)

        # Container for asset images
        assets_container = QWidget()
        assets_main_layout = QVBoxLayout(assets_container)
        assets_main_layout.setAlignment(Qt.AlignmentFlag.AlignTop)
        assets_main_layout.setSpacing(10)

        # Dictionary to store all asset labels
        self.asset_labels = {}

        # 1. ATB Icons (2 side by side, 30x30)
        atb_group = QGroupBox("ATB Icons")
        atb_layout = QHBoxLayout()
        for atb_name in ["ATB Normal", "ATB Enhanced"]:
            atb_container = QVBoxLayout()
            atb_title = QLabel(atb_name.replace("ATB ", ""))
            atb_title.setAlignment(Qt.AlignmentFlag.AlignCenter)
            atb_title.setStyleSheet("font-size: 9px;")
            label = QLabel("Missing")
            label.setAlignment(Qt.AlignmentFlag.AlignCenter)
            label.setFixedSize(30, 30)
            label.setStyleSheet("QLabel { background-color: #2b2b2b; border: 1px solid #444; }")
            label.setScaledContents(True)
            atb_container.addWidget(atb_title)
            atb_container.addWidget(label)
            atb_layout.addLayout(atb_container)
            self.asset_labels[atb_name] = label
        atb_group.setLayout(atb_layout)
        assets_main_layout.addWidget(atb_group)

        # 2. Skills (3 side by side, 30x30)
        skills_group = QGroupBox("Skills")
        skills_layout = QHBoxLayout()
        for skill_idx, skill_name in enumerate(["Skill 1", "Skill 2", "Skill Ultimate"], 1):
            skill_container = QVBoxLayout()
            skill_title = QLabel(f"S{skill_idx}" if skill_idx < 3 else "Ult")
            skill_title.setAlignment(Qt.AlignmentFlag.AlignCenter)
            skill_title.setStyleSheet("font-size: 9px;")
            label = QLabel("Missing")
            label.setAlignment(Qt.AlignmentFlag.AlignCenter)
            label.setFixedSize(30, 30)
            label.setStyleSheet("QLabel { background-color: #2b2b2b; border: 1px solid #444; }")
            label.setScaledContents(True)
            skill_container.addWidget(skill_title)
            skill_container.addWidget(label)
            skills_layout.addLayout(skill_container)
            self.asset_labels[skill_name] = label
        skills_group.setLayout(skills_layout)
        assets_main_layout.addWidget(skills_group)

        # 3. EX Equipment (30x30)
        ex_group = QGroupBox("EX Equipment")
        ex_layout = QHBoxLayout()
        ex_label = QLabel("Missing")
        ex_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        ex_label.setFixedSize(30, 30)
        ex_label.setStyleSheet("QLabel { background-color: #2b2b2b; border: 1px solid #444; }")
        ex_label.setScaledContents(True)
        ex_layout.addWidget(ex_label)
        ex_layout.addStretch()
        ex_group.setLayout(ex_layout)
        assets_main_layout.addWidget(ex_group)
        self.asset_labels["EX Equipment"] = ex_label

        # 4. Portrait (120x230)
        portrait_group = QGroupBox("Portrait")
        portrait_layout = QVBoxLayout()
        portrait_label = QLabel("Missing")
        portrait_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        portrait_label.setFixedSize(120, 230)
        portrait_label.setStyleSheet("QLabel { background-color: #2b2b2b; border: 1px solid #444; }")
        portrait_label.setScaledContents(False)  # Keep aspect ratio
        portrait_layout.addWidget(portrait_label, alignment=Qt.AlignmentFlag.AlignCenter)
        portrait_group.setLayout(portrait_layout)
        assets_main_layout.addWidget(portrait_group)
        self.asset_labels["Portrait"] = portrait_label

        # 5. Full Art (max width 200)
        full_group = QGroupBox("Full Art")
        full_layout = QVBoxLayout()
        full_label = QLabel("Missing")
        full_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        full_label.setMaximumWidth(200)
        full_label.setMinimumHeight(150)
        full_label.setStyleSheet("QLabel { background-color: #2b2b2b; border: 1px solid #444; }")
        full_label.setScaledContents(False)  # Keep aspect ratio
        full_layout.addWidget(full_label, alignment=Qt.AlignmentFlag.AlignCenter)
        full_group.setLayout(full_layout)
        assets_main_layout.addWidget(full_group)
        self.asset_labels["Full Art"] = full_label

        assets_scroll.setWidget(assets_container)
        assets_layout.addWidget(assets_scroll)
        right_splitter.addWidget(assets_panel)

        # Set initial sizes for splitter
        right_splitter.setSizes([600, 300])

        main_layout.addWidget(right_splitter, 2)

        # Add main layout to container
        container_layout.addLayout(main_layout)

        # Status label at bottom of entire window
        self.status_label = QLabel("Ready")
        self.status_label.setStyleSheet("QLabel { padding: 5px; background-color: #1e1e1e; border-top: 1px solid #444; }")
        container_layout.addWidget(self.status_label)

    def _load_character_list(self):
        """Load list of all playable characters"""
        try:
            cache = CacheManager(BYTES_FOLDER)
            char_data = cache.get_data("CharacterTemplet.bytes")
            text_char_data = cache.get_data("TextCharacter.bytes")
            char_extra_data = cache.get_data("CharacterExtraTemplet.bytes")

            # Build text index
            text_index = {t.get('IDSymbol'): t for t in text_char_data if t.get('IDSymbol')}

            # Build character extra index
            extra_index = {}
            for extra in char_extra_data:
                char_id = extra.get('CharacterID')
                if char_id:
                    extra_index[char_id] = extra

            # Build character list
            char_list = []
            for char in char_data:
                char_id = char.get('ID')
                if not char_id or not char_id.startswith('200') or char_id == '2000120':
                    continue

                # Get name
                name_id = char.get('NameIDSymbol')
                name_text = text_index.get(name_id)
                base_name = name_text.get('English', f'Character_{char_id}') if name_text else f'Character_{char_id}'

                # Check for surname
                fullname = base_name
                extra = extra_index.get(char_id)
                if extra:
                    show_nickname = extra.get('ShowNickName', 'False')
                    thumb_fb1 = extra.get('ThumbnailEffect_fallback1', 'False')
                    use_surname = show_nickname in ['True', 'true', '1'] or thumb_fb1 in ['True', 'true', '1']

                    if use_surname:
                        nick_id = char.get('GachaCommentIDSymbol')
                        nick_text = text_index.get(nick_id)
                        if nick_text:
                            nickname = nick_text.get('English', '')
                            if nickname:
                                fullname = f"{nickname} {base_name}".strip()

                char_list.append((char_id, fullname))

            # Sort and populate combo
            char_list.sort(key=lambda x: x[0])
            char_names = []
            for char_id, name in char_list:
                display_text = f"{char_id} - {name}"
                self.char_combo.addItem(display_text, char_id)
                char_names.append(display_text)

            # Setup autocomplete with QStringListModel
            completer = self.char_combo.completer()
            if completer:
                from PyQt6.QtCore import QStringListModel
                model = QStringListModel(char_names)
                completer.setModel(model)

            logger.info(f"Loaded {len(char_list)} characters")

        except Exception as e:
            logger.exception("Error loading character list")
            QMessageBox.critical(self, "Error", f"Failed to load character list:\n{str(e)}")

    def _extract_character(self):
        """Extract character data"""
        char_id = self.char_combo.currentData()
        if not char_id:
            QMessageBox.warning(self, "Warning", "Please select a character")
            return

        try:
            self.status_label.setText(f"Extracting character {char_id}...")
            QApplication.processEvents()

            # Extract from game files (already has ignored_effects filtered)
            extractor = CharacterExtractor(char_id)
            self.current_data = extractor.extract()
            self.current_char_id = char_id

            # Copy character assets
            self.status_label.setText(f"Copying assets for {char_id}...")
            QApplication.processEvents()

            asset_manager = AssetManager()
            asset_result = asset_manager.copy_character_assets(
                char_id,
                self.current_data.get('Fullname', 'Unknown')
            )

            # Log asset copy results
            copied_count = len(asset_result['copied'])
            skipped_count = len(asset_result['skipped'])
            missing_count = len(asset_result['missing'])
            webp_converted = asset_result.get('webp_converted', 0)
            webp_skipped = asset_result.get('webp_skipped', 0)
            total_count = copied_count + skipped_count + missing_count

            logger.info(f"Assets: {copied_count} copied, {skipped_count} skipped, {missing_count} missing")
            if webp_converted > 0 or webp_skipped > 0:
                logger.info(f"WebP: {webp_converted} converted, {webp_skipped} skipped")

            if copied_count > 0:
                logger.info(f"Copied assets: {', '.join(asset_result['copied'])}")
            if missing_count > 0:
                logger.warning(f"Missing assets: {', '.join(asset_result['missing'])}")

            # Load existing JSON and copy manual fields to current_data
            self._load_existing_json()

            # Update UI
            self._update_character_info()
            self._update_manual_fields()
            self._update_json_preview()
            self._update_assets_preview()

            # Enable buttons
            self.replace_live_btn.setEnabled(True)
            self.compare_btn.setEnabled(True)

            # Update status with asset info
            asset_info = f" | Assets: {copied_count} new, {skipped_count} existing, {missing_count} missing"
            if webp_converted > 0:
                asset_info += f" | WebP: {webp_converted} converted"
            self.status_label.setText(f"[OK] Extracted: {self.current_data['Fullname']}{asset_info}")

        except Exception as e:
            logger.exception("Error extracting character")
            QMessageBox.critical(self, "Error", f"Failed to extract character:\n{str(e)}")
            self.status_label.setText("[ERROR] Extraction failed")

    def _update_character_info(self):
        """Update character info display"""
        if not self.current_data:
            return

        info_text = f"<b>{self.current_data['Fullname']}</b><br>"
        info_text += f"ID: {self.current_data['ID']}<br>"
        info_text += f"{self.current_data['Rarity']}★ {self.current_data['Element']} {self.current_data['Class']}"
        self.char_info_label.setText(info_text)

    def _update_manual_fields(self):
        """Update manual fields from data"""
        if not self.current_data:
            return

        # Block signals to avoid triggering _on_manual_field_changed during initial load
        self.role_combo.blockSignals(True)
        self.rank_combo.blockSignals(True)
        self.rank_pvp_combo.blockSignals(True)
        self.free_checkbox.blockSignals(True)
        self.video_edit.blockSignals(True)
        self.prio_first.blockSignals(True)
        self.prio_second.blockSignals(True)
        self.prio_ult.blockSignals(True)

        # Set role
        role = self.current_data.get('role', '')
        self.role_combo.setCurrentText(role if role else "")

        # Set ranks
        rank = self.current_data.get('rank', '')
        self.rank_combo.setCurrentText(rank if rank else "")

        rank_pvp = self.current_data.get('rank_pvp', '')
        self.rank_pvp_combo.setCurrentText(rank_pvp if rank_pvp else "")

        # Set free checkbox
        tags = self.current_data.get('tags', [])
        self.free_checkbox.setChecked('free' in tags)

        # Set video
        video = self.current_data.get('video', '')
        self.video_edit.setText(video if video else "")

        # Set priorities (handle both old and new formats)
        skill_prio = self.current_data.get('skill_priority', {})

        # Old format: {"First": 1, "Second": 2, "Ultimate": 3}
        # New format: {"First": {"prio": 1}, "Second": {"prio": 2}, "Ultimate": {"prio": 3}}
        first_val = skill_prio.get('First', 1)
        second_val = skill_prio.get('Second', 2)
        ult_val = skill_prio.get('Ultimate', 3)

        # If it's the new format (dict), extract prio value
        if isinstance(first_val, dict):
            first_val = first_val.get('prio', 1)
        if isinstance(second_val, dict):
            second_val = second_val.get('prio', 2)
        if isinstance(ult_val, dict):
            ult_val = ult_val.get('prio', 3)

        self.prio_first.setValue(first_val)
        self.prio_second.setValue(second_val)
        self.prio_ult.setValue(ult_val)

        # Re-enable signals
        self.role_combo.blockSignals(False)
        self.rank_combo.blockSignals(False)
        self.rank_pvp_combo.blockSignals(False)
        self.free_checkbox.blockSignals(False)
        self.video_edit.blockSignals(False)
        self.prio_first.blockSignals(False)
        self.prio_second.blockSignals(False)
        self.prio_ult.blockSignals(False)

    def _sort_lang_dict(self, data: dict) -> dict:
        """
        Sort dictionary keys with language variants in proper order.
        For each base key (e.g., "2", "4_1"), orders variants as: base, _jp, _kr, _zh

        Example:
            Input: {"2": "...", "3_zh": "...", "2_jp": "...", "3": "..."}
            Output: {"2": "...", "2_jp": "...", "2_kr": "...", "2_zh": "...", "3": "...", "3_zh": "..."}
        """
        result = {}

        # Get all unique base keys (without language suffixes)
        all_keys = set()
        for key in data.keys():
            # Extract base key: "4_1_kr" -> "4_1", "3_jp" -> "3", "5" -> "5"
            if key.endswith('_jp') or key.endswith('_kr') or key.endswith('_zh'):
                base_key = key.rsplit('_', 1)[0]  # Remove last suffix
            else:
                base_key = key
            all_keys.add(base_key)

        # Sort base keys: handle "4_1", "4_2", "5_1" etc
        def sort_key(x):
            parts = x.split('_')
            if len(parts) == 1 and parts[0].isdigit():
                return (int(parts[0]), 0)  # "3" -> (3, 0)
            elif len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                return (int(parts[0]), int(parts[1]))  # "4_1" -> (4, 1)
            else:
                return (999, 0)  # Non-numeric keys last

        sorted_base_keys = sorted(all_keys, key=sort_key)

        # For each base key, add variants in order: base (en), _jp, _kr, _zh
        lang_order = ['', '_jp', '_kr', '_zh']
        for base_key in sorted_base_keys:
            for lang_suffix in lang_order:
                full_key = f"{base_key}{lang_suffix}" if lang_suffix else base_key
                if full_key in data:
                    result[full_key] = data[full_key]

        return result

    def _reorder_json(self, data: dict) -> dict:
        """Reorder JSON fields for better readability"""
        ordered = {}

        # Top-level fields in desired order
        field_order = [
            'ID',
            'Fullname', 'Fullname_jp', 'Fullname_kr', 'Fullname_zh',
            'Rarity',
            'Element',
            'Class',
            'SubClass',
            'rank',
            'rank_pvp',
            'role',
            'tags',
            'skill_priority',
            'Chain_Type',
            'gift',
            'video',
            'VoiceActor', 'VoiceActor_jp', 'VoiceActor_kr', 'VoiceActor_zh',
        ]

        # Add top-level fields in order
        for field in field_order:
            if field in data:
                ordered[field] = data[field]

        # Add transcend object (new format) with sorted keys
        if 'transcend' in data:
            ordered['transcend'] = self._sort_lang_dict(data['transcend'])

        # Add transcend fields (old format - numerical order, then by language)
        transcend_keys = sorted([k for k in data.keys() if k.startswith('Transcend_')])
        for key in transcend_keys:
            ordered[key] = data[key]

        # Add skills in order: SKT_FIRST, SKT_SECOND, SKT_ULTIMATE, SKT_PASSIVE
        skill_order = ['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE', 'SKT_PASSIVE', 'SKT_CHAIN_PASSIVE']
        for skill_key in skill_order:
            if skill_key in data:
                skill_data = data[skill_key]
                ordered_skill = {}

                # Skill field order (language grouped: EN, JP, KR, ZH)
                skill_field_order = [
                    'name', 'name_jp', 'name_kr', 'name_zh',
                    'true_desc', 'true_desc_jp', 'true_desc_kr', 'true_desc_zh',
                    'cd',
                    'wgr',
                    'buff',
                    'dual_buff',
                    'debuff',
                    'dual_debuff',
                    'burneffect',
                    'enhancement', 'enhancement_jp', 'enhancement_kr', 'enhancement_zh',
                ]

                for field in skill_field_order:
                    if field in skill_data:
                        # Sort enhancement dict if it exists
                        if field == 'enhancement' and isinstance(skill_data[field], dict):
                            ordered_skill[field] = self._sort_lang_dict(skill_data[field])
                        else:
                            ordered_skill[field] = skill_data[field]

                # Add any remaining fields (dual_buff, dual_debuff, etc.)
                for field in skill_data:
                    if field not in ordered_skill:
                        ordered_skill[field] = skill_data[field]

                ordered[skill_key] = ordered_skill

        # Add any remaining fields not in the order list
        for key in data:
            if key not in ordered:
                ordered[key] = data[key]

        return ordered

    def _update_json_preview(self):
        """Update JSON preview"""
        if not self.current_data:
            self.json_text.clear()
            return

        # Reorder JSON for better readability
        ordered_data = self._reorder_json(self.current_data)
        json_str = json.dumps(ordered_data, indent=2, ensure_ascii=False)
        self.json_text.setPlainText(json_str)

    def _update_assets_preview(self):
        """Update assets preview with actual images"""
        if not self.current_char_id:
            # Reset all labels to "Missing"
            for label in self.asset_labels.values():
                label.clear()
                label.setText("Missing")
            return

        char_id = self.current_char_id
        fullname = self.current_data.get('Fullname', 'Unknown')
        kebab_name = to_kebab_case(fullname)

        # Public image paths (destination)
        public_base = PUBLIC_CHARACTERS

        # Asset mapping: label name -> (file path, max width, max height, scale mode)
        asset_configs = {
            "Portrait": (public_base / "portrait" / f"CT_{char_id}.png", 120, 230, Qt.AspectRatioMode.KeepAspectRatio),
            "ATB Normal": (public_base / "atb" / f"IG_Turn_{char_id}.png", 30, 30, Qt.AspectRatioMode.KeepAspectRatio),
            "ATB Enhanced": (public_base / "atb" / f"IG_Turn_{char_id}_E.png", 30, 30, Qt.AspectRatioMode.KeepAspectRatio),
            "Skill 1": (public_base / "skills" / f"Skill_First_{char_id}.png", 30, 30, Qt.AspectRatioMode.KeepAspectRatio),
            "Skill 2": (public_base / "skills" / f"Skill_Second_{char_id}.png", 30, 30, Qt.AspectRatioMode.KeepAspectRatio),
            "Skill Ultimate": (public_base / "skills" / f"Skill_Ultimate_{char_id}.png", 30, 30, Qt.AspectRatioMode.KeepAspectRatio),
            "Full Art": (public_base / "full" / f"IMG_{char_id}.png", 200, 9999, Qt.AspectRatioMode.KeepAspectRatio),
            "EX Equipment": (public_base / "ex" / f"{kebab_name}.png", 30, 30, Qt.AspectRatioMode.KeepAspectRatio)
        }

        # Load and display each asset
        for asset_name, (asset_path, max_width, max_height, aspect_mode) in asset_configs.items():
            label = self.asset_labels[asset_name]

            if asset_path.exists():
                pixmap = QPixmap(str(asset_path))
                if not pixmap.isNull():
                    # Scale to fit label while keeping aspect ratio
                    scaled_pixmap = pixmap.scaled(
                        max_width, max_height,
                        aspect_mode,
                        Qt.TransformationMode.SmoothTransformation
                    )
                    label.setPixmap(scaled_pixmap)
                    label.setText("")  # Clear text
                else:
                    label.clear()
                    label.setText("Error")
            else:
                label.clear()
                label.setText("Missing")

    def _on_manual_field_changed(self):
        """Called when any manual field is changed - updates current_data automatically"""
        if not self.current_data:
            return

        # Update role
        role = self.role_combo.currentText()
        if role and role in self.VALID_ROLES:
            self.current_data['role'] = role

        # Update ranks
        rank = self.rank_combo.currentText() or None
        rank_pvp = self.rank_pvp_combo.currentText() or None
        self.current_data['rank'] = rank
        self.current_data['rank_pvp'] = rank_pvp

        # Update video
        video = self.video_edit.text().strip() or None
        if video:
            self.current_data['video'] = video
        elif 'video' in self.current_data:
            del self.current_data['video']

        # Update tags (free)
        if 'tags' not in self.current_data:
            self.current_data['tags'] = []

        is_free = self.free_checkbox.isChecked()
        if is_free and 'free' not in self.current_data['tags']:
            self.current_data['tags'].append('free')
        elif not is_free and 'free' in self.current_data['tags']:
            self.current_data['tags'].remove('free')

        # Update skill_priority
        prio_first = self.prio_first.value()
        prio_second = self.prio_second.value()
        prio_ult = self.prio_ult.value()

        self.current_data['skill_priority'] = {
            "First": {"prio": prio_first},
            "Second": {"prio": prio_second},
            "Ultimate": {"prio": prio_ult}
        }

        # Update JSON preview
        self._update_json_preview()

        self.status_label.setText("[OK] Manual fields auto-updated")

    def _replace_live_file(self):
        """Replace the live file in src/data/char/ with the exported file"""
        if not self.current_data:
            QMessageBox.warning(self, "Warning", "No character data available")
            return

        try:
            fullname = self.current_data.get('Fullname', '')
            filename = to_kebab_case(fullname) + '.json'

            # Destination: src/data/char/
            live_path = CHAR_DATA_FOLDER / filename

            # Validate buffs/debuffs before saving
            self.status_label.setText("Validating buffs/debuffs...")
            QApplication.processEvents()

            # Reorder JSON before validation
            ordered_data = self._reorder_json(self.current_data)

            # Check for missing buffs/debuffs using export_manager
            result = self.export_manager.export_character(ordered_data)

            # Process missing buffs/debuffs with user interaction
            for buff, metadata in result['missing_buffs']:
                action = self._handle_missing_effect(buff, metadata, is_buff=True)
                if action == 'skip':
                    continue
                elif action == 'ignore':
                    self.export_manager.add_ignored(buff)
                elif isinstance(action, dict):
                    # Complete metadata - add to buffs.json
                    action['name'] = buff
                    self.export_manager.add_buff(action)

            for debuff, metadata in result['missing_debuffs']:
                action = self._handle_missing_effect(debuff, metadata, is_buff=False)
                if action == 'skip':
                    continue
                elif action == 'ignore':
                    self.export_manager.add_ignored(debuff)
                elif isinstance(action, dict):
                    # Complete metadata - add to debuffs.json
                    action['name'] = debuff
                    self.export_manager.add_debuff(action)

            # Update current_data with ordered version
            self.current_data = ordered_data

            # Confirm save/replacement
            action = "overwrite" if live_path.exists() else "create"
            reply = QMessageBox.question(
                self,
                "Confirm Save",
                f"Save character data?\n\nFile: {filename}\n\nLocation: src/data/char/\n\nThis will {action} the file!",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No
            )

            if reply != QMessageBox.StandardButton.Yes:
                self.status_label.setText("[CANCELLED] Save cancelled")
                return

            # Update character profile
            self.status_label.setText(f"Updating profile...")
            QApplication.processEvents()

            profile_manager = ProfileManager()
            profile_updated = profile_manager.extract_and_update(
                self.current_char_id,
                self.current_data.get('Fullname', ''),
                self.current_data.get('Fullname_jp', ''),
                self.current_data.get('Fullname_kr', ''),
                self.current_data.get('Fullname_zh', '')
            )

            profile_msg = ("Profile updated!" if profile_updated else "Profile already up to date")

            # Update EE (Exclusive Equipment)
            self.status_label.setText(f"Extracting EE data...")
            QApplication.processEvents()

            ee_manager = EEManager()
            fullname = self.current_data.get('Fullname', '')

            # Extract EE data
            ee_dict = ee_manager.extract_ee(self.current_char_id, fullname)

            ee_updated = False
            if ee_dict:
                # Get existing buffs/debuffs/rank if any
                kebab_name = to_kebab_case(fullname)
                existing_ee = ee_manager.ee_data.get(kebab_name, {})
                existing_buffs = existing_ee.get('buff', [])
                existing_debuffs = existing_ee.get('debuff', [])
                existing_rank = existing_ee.get('rank', '')

                # Get effects from ee_dict (they are already strings in English)
                ee_effect = ee_dict.get('effect', '')
                ee_effect10 = ee_dict.get('effect10', '')

                # Show dialog to select buffs/debuffs/rank
                self.status_label.setText(f"Waiting for buff/debuff/rank selection...")
                QApplication.processEvents()

                dialog = EEBuffDebuffDialog(
                    self,
                    fullname,
                    existing_buffs,
                    existing_debuffs,
                    existing_rank,
                    ee_effect,
                    ee_effect10
                )

                if dialog.exec() and dialog.result:
                    # User confirmed, add selected buffs/debuffs/rank to ee_dict
                    ee_dict['buff'] = dialog.result['buff']
                    ee_dict['debuff'] = dialog.result['debuff']
                    ee_dict['rank'] = dialog.result['rank']

                    # Update EE file
                    self.status_label.setText(f"Updating EE...")
                    QApplication.processEvents()
                    ee_updated = ee_manager.update_ee(fullname, ee_dict)
                else:
                    # User cancelled
                    ee_msg = "EE update cancelled"

            if ee_dict and ee_updated:
                ee_msg = "EE updated!"
            elif ee_dict and not ee_updated:
                ee_msg = "EE already up to date"
            else:
                ee_msg = "No EE data found for this character"

            # Save the character JSON file
            self.status_label.setText(f"Saving character file...")
            QApplication.processEvents()

            with open(live_path, 'w', encoding='utf-8') as f:
                json.dump(self.current_data, f, indent=2, ensure_ascii=False)

            self.status_label.setText(f"[OK] File saved: {filename}")
            QMessageBox.information(
                self,
                "Save Complete",
                f"Character data saved successfully!\n\n"
                f"File: {filename}\n"
                f"Location: src/data/char/\n\n"
                f"{profile_msg}\n"
                f"{ee_msg}"
            )

            # Reload the existing data to reflect changes
            self._load_existing_json()

        except Exception as e:
            logger.exception("Error saving file")
            QMessageBox.critical(self, "Save Error", f"Failed to save file:\n{str(e)}")
            self.status_label.setText("[ERROR] Save failed")

    def _handle_missing_effect(self, effect_name: str, metadata: dict, is_buff: bool):
        """
        Handle a missing buff/debuff effect

        Returns:
            'skip' - skip this effect
            'ignore' - add to ignored list
            dict - complete metadata to add
        """
        dialog = MetadataInputDialog(self, effect_name, is_buff, metadata)
        dialog.exec()
        return dialog.result

    def _load_existing_json(self):
        """Load existing character JSON if it exists"""
        self.existing_data = None

        if not self.current_data:
            return

        fullname = self.current_data.get('Fullname', '')
        filename = to_kebab_case(fullname) + '.json'

        # Try data/char/
        json_path = CHAR_DATA_FOLDER / filename

        logger.info(f"Looking for existing JSON: {json_path}")

        try:
            if json_path.exists():
                with open(json_path, 'r', encoding='utf-8') as f:
                    self.existing_data = json.load(f)

                # Copy manual fields from live JSON to GUI JSON (simple assignment)
                # video
                if 'video' in self.existing_data and self.existing_data['video']:
                    self.current_data['video'] = self.existing_data['video']

                # rank
                if 'rank' in self.existing_data and self.existing_data['rank'] is not None:
                    self.current_data['rank'] = self.existing_data['rank']

                # rank_pvp
                if 'rank_pvp' in self.existing_data and self.existing_data['rank_pvp'] is not None:
                    self.current_data['rank_pvp'] = self.existing_data['rank_pvp']

                # role
                if 'role' in self.existing_data and self.existing_data['role']:
                    self.current_data['role'] = self.existing_data['role']

                # skill_priority (normalize old format to new format)
                if 'skill_priority' in self.existing_data and self.existing_data['skill_priority']:
                    old_prio = self.existing_data['skill_priority']
                    normalized_prio = {}
                    for skill in ['First', 'Second', 'Ultimate']:
                        if skill in old_prio:
                            val = old_prio[skill]
                            # Old format: direct int, New format: {"prio": int}
                            if isinstance(val, dict):
                                normalized_prio[skill] = {"prio": val.get('prio', 1)}
                            else:
                                normalized_prio[skill] = {"prio": val}
                        else:
                            normalized_prio[skill] = {"prio": 0}
                    self.current_data['skill_priority'] = normalized_prio

                logger.info(f"✓ Loaded existing JSON: {json_path}")
            else:
                logger.info(f"✗ No existing JSON found at: {json_path}")
        except Exception as e:
            logger.exception("Error loading existing JSON")
            self.existing_data = None

    def _compare_with_existing(self):
        """Compare GUI JSON with existing live JSON"""
        if not self.current_data or not self.existing_data:
            msg = "Cannot compare:\n"
            if not self.current_data:
                msg += "- No extracted data\n"
            if not self.existing_data:
                msg += f"- No existing JSON found\n"
                msg += f"  Expected at: {CHAR_DATA_FOLDER / (to_kebab_case(self.current_data.get('Fullname', '')) + '.json')}"
            QMessageBox.warning(self, "Warning", msg)
            return

        # Compare current_data (GUI JSON) with existing_data (live JSON)
        comparator = JSONComparator(self.current_data, self.existing_data)
        comparator.get_diff()  # IMPORTANT: Must call this to actually perform the comparison!
        summary = comparator.get_summary()

        # If no changes, just show status message
        if not summary['has_changes']:
            self.status_label.setText("[OK] No differences found - JSONs are identical")
            return

        # There are changes, show the dialog
        diff_str = comparator.format_diff_for_display()

        # Create custom dialog
        from PyQt6.QtWidgets import QDialog, QVBoxLayout, QTextEdit, QPushButton, QLabel

        dialog = QDialog(self)
        dialog.setWindowTitle(f"Comparison: {self.current_data['Fullname']}")
        dialog.setGeometry(200, 200, 800, 600)

        # Set dark theme for dialog
        dialog.setStyleSheet("""
            QDialog {
                background-color: #2b2b2b;
                color: #ffffff;
            }
            QLabel {
                color: #ffffff;
            }
            QTextEdit {
                background-color: #1e1e1e;
                color: #ffffff;
                border: 1px solid #555;
            }
            QPushButton {
                background-color: #3c3c3c;
                color: #ffffff;
                border: 1px solid #555;
                padding: 5px 15px;
            }
            QPushButton:hover {
                background-color: #4c4c4c;
            }
        """)

        layout = QVBoxLayout(dialog)

        # Summary (we only show this dialog if there are changes)
        summary_text = f"Changes found:\n"
        summary_text += f"  • Added fields: {summary['added_count']}\n"
        summary_text += f"  • Removed fields: {summary['removed_count']}\n"
        summary_text += f"  • Modified fields: {summary['modified_count']}\n"
        summary_text += f"  • Unchanged fields: {summary['unchanged_count']}"

        summary_label = QLabel(summary_text)
        summary_label.setStyleSheet("font-weight: bold; padding: 10px; background-color: #3c3c3c; border-radius: 5px;")
        layout.addWidget(summary_label)

        # Diff display
        diff_text = QTextEdit()
        diff_text.setPlainText(diff_str)
        diff_text.setReadOnly(True)
        diff_text.setFontFamily("Courier New")
        diff_text.setFontPointSize(9)
        layout.addWidget(diff_text)

        # Close button
        close_btn = QPushButton("Close")
        close_btn.clicked.connect(dialog.close)
        layout.addWidget(close_btn)

        dialog.exec()

    def eventFilter(self, obj, event):
        """Event filter to show dropdown on click in editable combo box"""
        if obj == self.char_combo.lineEdit() and event.type() == event.Type.MouseButtonPress:
            self.char_combo.showPopup()
        return super().eventFilter(obj, event)


class BossTab(QWidget):
    """Tab for Boss data management"""

    def __init__(self):
        super().__init__()
        self._setup_ui()

    def _setup_ui(self):
        """Setup the Boss tab UI"""
        layout = QVBoxLayout(self)

        # Search section (compact, fixed size)
        search_group = QGroupBox("Search Boss")
        search_layout = QVBoxLayout()

        # Description
        desc_label = QLabel("Search by name - all levels and locations will be shown")
        desc_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        search_layout.addWidget(desc_label)

        # Search input: Name only
        name_layout = QHBoxLayout()
        name_label = QLabel("Monster Name:")
        name_layout.addWidget(name_label)

        self.name_input = QLineEdit()
        self.name_input.setPlaceholderText("e.g., Ziggsaron, Blockbuster, Nella, Drakhan, Masterless Guardian...")
        self.name_input.returnPressed.connect(self._search_boss)  # Search on Enter key
        name_layout.addWidget(self.name_input)

        # Search button
        self.search_btn = QPushButton("Search")
        self.search_btn.clicked.connect(self._search_boss)
        name_layout.addWidget(self.search_btn)

        search_layout.addLayout(name_layout)

        # Export button
        export_layout = QHBoxLayout()
        self.export_boss_btn = QPushButton("Export Current Boss to JSON")
        self.export_boss_btn.clicked.connect(self._export_current_boss)
        self.export_boss_btn.setEnabled(False)  # Disabled until a boss is selected
        export_layout.addWidget(self.export_boss_btn)
        search_layout.addLayout(export_layout)

        # Status label
        self.status_label = QLabel("Enter a monster name to search")
        search_layout.addWidget(self.status_label)

        search_group.setLayout(search_layout)
        layout.addWidget(search_group)

        # Result selector (for multiple results)
        selector_layout = QHBoxLayout()
        selector_label = QLabel("Select Boss:")
        selector_layout.addWidget(selector_label)

        self.result_selector = QComboBox()
        self.result_selector.currentIndexChanged.connect(self._on_result_selected)
        selector_layout.addWidget(self.result_selector)

        # Initially hidden until we have multiple results
        self.selector_widget = QWidget()
        self.selector_widget.setLayout(selector_layout)
        self.selector_widget.hide()
        layout.addWidget(self.selector_widget)

        # Store results for selection
        self.current_results = []
        self.current_selected_index = -1
        self.boss_finder = None

        # Results display - split into text (left) and images (right)
        results_splitter = QSplitter(Qt.Orientation.Horizontal)

        # Left panel: Text results
        self.results_display = QTextEdit()
        self.results_display.setReadOnly(True)
        results_splitter.addWidget(self.results_display)

        # Right panel: Images display
        self.images_display = QTextBrowser()
        self.images_display.setReadOnly(True)
        self.images_display.setOpenExternalLinks(False)
        self.images_display.setMaximumWidth(400)
        results_splitter.addWidget(self.images_display)

        # Set initial sizes (70% text, 30% images)
        results_splitter.setStretchFactor(0, 7)
        results_splitter.setStretchFactor(1, 3)

        # Add results splitter with stretch factor to take remaining space
        layout.addWidget(results_splitter, stretch=1)

    def _search_boss(self):
        """Search for boss by name only - returns all matching bosses at all levels"""
        try:
            # Get search input
            search_name = self.name_input.text().strip()

            if not search_name:
                self.status_label.setText("Please enter a monster name")
                return

            self.results_display.clear()
            self.status_label.setText(f"Searching for '{search_name}'...")
            QApplication.processEvents()

            # Use BossFinder to perform the search (search all levels)
            self.boss_finder = BossFinder(BYTES_FOLDER)
            results = self.boss_finder.search_boss_all_levels(search_name)

            # Store results
            self.current_results = results

            if not results:
                self.status_label.setText("No results found")
                self.selector_widget.hide()
                self.results_display.clear()
                self.images_display.clear()
                return

            # Show selector with all results
            self.result_selector.blockSignals(True)
            self.result_selector.clear()

            # Populate selector with "Name - dungeon - level"
            import json
            json_output = self.boss_finder.format_results_json(results)
            for idx, boss_json in enumerate(json_output):
                name = boss_json.get('Name', {}).get('en', 'Unknown')
                dungeon = boss_json.get('location', {}).get('dungeon', {}).get('en', 'Unknown location')
                level = boss_json.get('level', '?')
                display_text = f"{name} - {dungeon} - Lv{level}"
                self.result_selector.addItem(display_text, idx)

            self.result_selector.blockSignals(False)
            self.selector_widget.show()

            # Display first result
            self._display_result(0)

            self.status_label.setText(f"Found {len(results)} result(s)")
            logger.info(f"Found {len(results)} boss(es) matching '{search_name}'")

        except Exception as e:
            logger.exception("Error searching for boss")
            QMessageBox.critical(self, "Error", f"Failed to search for boss:\n{str(e)}")
            self.status_label.setText("[ERROR] Search failed")
            self.results_display.setText(f"Error: {str(e)}")

    def _on_result_selected(self, index):
        """Handle result selection from combo box"""
        if index >= 0 and index < len(self.current_results):
            self._display_result(index)

    def _display_result(self, index):
        """Display a specific result by index"""
        if not self.current_results or index < 0 or index >= len(self.current_results):
            return

        try:
            # Store current selected index
            self.current_selected_index = index

            # Get the single result
            result = self.current_results[index]

            # Format and display results
            # Left panel: JSON output (only the selected result)
            import json
            json_output = self.boss_finder.format_results_json([result])
            formatted_json = json.dumps(json_output, indent=2, ensure_ascii=False)
            self.results_display.setText(formatted_json)

            # Right panel: Images (HTML)
            image_base_path = "../extracted_astudio/assets/editor/resources"
            formatted_images = self.boss_finder.format_results_images([result], image_base_path)
            self.images_display.setHtml(formatted_images)

            # Enable export button
            self.export_boss_btn.setEnabled(True)

        except Exception as e:
            logger.exception(f"Error displaying result {index}")
            self.results_display.setText(f"Error displaying result: {str(e)}")

    def _copy_boss_images(self, boss_data: dict) -> dict:
        """Copy boss images to destination folders

        Returns a dict with counts of copied images:
        {
            'skill_icons': int,
            'portrait': bool,
            'mini': bool
        }
        """
        copied = {'skill_icons': 0, 'portrait': False, 'mini': False}

        try:
            # Ensure destination folders exist
            BOSS_SKILL_IMAGE_FOLDER.mkdir(parents=True, exist_ok=True)
            BOSS_PORTRAIT_IMAGE_FOLDER.mkdir(parents=True, exist_ok=True)
            BOSS_MINI_IMAGE_FOLDER.mkdir(parents=True, exist_ok=True)

            # Copy skill icons
            skills = boss_data.get('skills', [])
            for skill in skills:
                icon_name = skill.get('icon', '')
                if icon_name:
                    # Skill icons are like "Skill_First_2000062"
                    source_file = SPRITE_SOURCE_FOLDER / f"{icon_name}.png"
                    dest_file = BOSS_SKILL_IMAGE_FOLDER / f"{icon_name}.png"

                    if source_file.exists() and not dest_file.exists():
                        shutil.copy2(source_file, dest_file)
                        copied['skill_icons'] += 1
                        logger.info(f"Copied skill icon: {icon_name}.png")

            # Copy portrait and mini icons
            icons = boss_data.get('icons', '')
            if icons:
                is_character_id = icons.startswith('2000')

                # Portrait: MT_{icons}.png (only if NOT a character ID)
                if not is_character_id:
                    portrait_name = f"MT_{icons}.png"
                    source_portrait = SPRITE_SOURCE_FOLDER / portrait_name
                    dest_portrait = BOSS_PORTRAIT_IMAGE_FOLDER / portrait_name

                    if source_portrait.exists() and not dest_portrait.exists():
                        shutil.copy2(source_portrait, dest_portrait)
                        copied['portrait'] = True
                        logger.info(f"Copied portrait: {portrait_name}")

                # Mini icon: IG_Turn_{icons}.png or IG_Turn_{icons}_E.png
                if is_character_id:
                    # For character IDs (2000xxx), use _E version
                    mini_name = f"IG_Turn_{icons}_E.png"
                else:
                    # For non-character IDs, use regular version
                    mini_name = f"IG_Turn_{icons}.png"

                source_mini = SPRITE_SOURCE_FOLDER / mini_name
                dest_mini = BOSS_MINI_IMAGE_FOLDER / mini_name

                if source_mini.exists() and not dest_mini.exists():
                    shutil.copy2(source_mini, dest_mini)
                    copied['mini'] = True
                    logger.info(f"Copied mini icon: {mini_name}")

        except Exception as e:
            logger.exception("Error copying boss images")

        return copied

    def _export_current_boss(self):
        """Export the currently selected boss to JSON file"""
        try:
            if not self.current_results or self.current_selected_index < 0:
                QMessageBox.warning(self, "No Boss Selected", "Please search and select a boss first")
                return

            # Get the currently selected result
            result = self.current_results[self.current_selected_index]

            # Format as JSON (single boss)
            import json
            json_output = self.boss_finder.format_results_json([result])
            boss_data = json_output[0]  # Get the single boss object

            # Get boss ID for filename
            boss_id = boss_data.get('id', 'unknown')
            boss_name = boss_data.get('Name', {}).get('en', 'Unknown')

            # Ensure boss data folder exists
            BOSS_DATA_FOLDER.mkdir(parents=True, exist_ok=True)

            # Build file path: src/data/boss/{id}.json
            filename = f"{boss_id}.json"
            file_path = BOSS_DATA_FOLDER / filename

            # Check if file exists
            if file_path.exists():
                reply = QMessageBox.question(
                    self,
                    "Confirm Overwrite",
                    f"File already exists:\n\n{filename}\n\nDo you want to overwrite it?",
                    QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                    QMessageBox.StandardButton.No
                )
                if reply == QMessageBox.StandardButton.No:
                    self.status_label.setText("[CANCELLED] Export cancelled")
                    return

            # Save the JSON file
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(boss_data, f, indent=2, ensure_ascii=False)

            # Copy boss images
            copied = self._copy_boss_images(boss_data)

            # Build summary message
            image_summary = []
            if copied['skill_icons'] > 0:
                image_summary.append(f"Skill icons: {copied['skill_icons']}")
            if copied['portrait']:
                image_summary.append("Portrait: 1")
            if copied['mini']:
                image_summary.append("Mini icon: 1")

            total_images = copied['skill_icons'] + (1 if copied['portrait'] else 0) + (1 if copied['mini'] else 0)

            if total_images > 0:
                images_msg = f"\n\nImages copied: {total_images}\n" + "\n".join(image_summary)
            else:
                images_msg = "\n\nNo new images to copy (all already exist)"

            self.status_label.setText(f"[OK] Exported: {filename} + {total_images} images")
            logger.info(f"Boss data exported to: {file_path}")

            QMessageBox.information(
                self,
                "Export Complete",
                f"Boss data exported successfully!\n\nBoss: {boss_name}\nFile: {filename}\nLocation: {BOSS_DATA_FOLDER}{images_msg}"
            )

        except Exception as e:
            logger.exception("Error exporting boss")
            QMessageBox.critical(self, "Error", f"Failed to export boss:\n{str(e)}")
            self.status_label.setText("[ERROR] Export failed")


class BossTabV2(QWidget):
    """Boss Tab V2 - Simplified search with exact name matching"""

    def __init__(self):
        super().__init__()
        self._setup_ui()

    def _setup_ui(self):
        """Setup the Boss V2 tab UI"""
        layout = QVBoxLayout(self)

        # Search section
        search_group = QGroupBox("Search Boss (V2 - Exact Match)")
        search_layout = QVBoxLayout()

        # Description
        desc_label = QLabel("Search by exact name - only shows exact matches (no ModelID grouping)")
        desc_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        search_layout.addWidget(desc_label)

        # Search input
        name_layout = QHBoxLayout()
        name_label = QLabel("Boss Name:")
        name_layout.addWidget(name_label)

        self.name_input = QLineEdit()
        self.name_input.setPlaceholderText("e.g., Betrayed Deshret, Typhoon Summoning Traitor...")
        self.name_input.returnPressed.connect(self._search_boss)
        name_layout.addWidget(self.name_input)

        # Search button
        self.search_btn = QPushButton("Search")
        self.search_btn.clicked.connect(self._search_boss)
        name_layout.addWidget(self.search_btn)

        search_layout.addLayout(name_layout)

        # Status label
        self.status_label = QLabel("Enter a boss name to search")
        search_layout.addWidget(self.status_label)

        search_group.setLayout(search_layout)
        layout.addWidget(search_group)

        # Filter selectors (Mode and Dungeon)
        filter_layout = QHBoxLayout()

        # Mode filter
        mode_label = QLabel("Filter by Mode:")
        filter_layout.addWidget(mode_label)
        self.mode_filter = QComboBox()
        self.mode_filter.setMinimumWidth(200)
        self.mode_filter.currentIndexChanged.connect(self._on_filter_changed)
        filter_layout.addWidget(self.mode_filter)

        # Dungeon filter
        dungeon_label = QLabel("Filter by Dungeon:")
        filter_layout.addWidget(dungeon_label)
        self.dungeon_filter = QComboBox()
        self.dungeon_filter.setMinimumWidth(250)
        self.dungeon_filter.currentIndexChanged.connect(self._on_filter_changed)
        filter_layout.addWidget(self.dungeon_filter)

        filter_layout.addStretch()

        self.filter_widget = QWidget()
        self.filter_widget.setLayout(filter_layout)
        self.filter_widget.hide()
        layout.addWidget(self.filter_widget)

        # Result selector
        selector_layout = QHBoxLayout()
        selector_label = QLabel("Select Result:")
        selector_layout.addWidget(selector_label)

        self.result_selector = QComboBox()
        self.result_selector.currentIndexChanged.connect(self._on_result_selected)
        selector_layout.addWidget(self.result_selector)

        # Extract button
        self.extract_button = QPushButton("Extract")
        self.extract_button.clicked.connect(self._extract_current_boss)
        self.extract_button.setStyleSheet("background-color: #4CAF50; color: white; font-weight: bold; padding: 5px 15px;")
        selector_layout.addWidget(self.extract_button)

        self.selector_widget = QWidget()
        self.selector_widget.setLayout(selector_layout)
        self.selector_widget.hide()
        layout.addWidget(self.selector_widget)

        # Store results
        self.all_results = []  # All results from search (unfiltered)
        self.current_results = []  # Filtered results
        self.current_selected_index = -1
        self.boss_finder = None
        self.system_text_index = None  # Cache for translations

        # Results display (horizontal layout with text + icons)
        results_layout = QHBoxLayout()

        # Text display on the left
        self.results_display = QTextEdit()
        self.results_display.setReadOnly(True)
        results_layout.addWidget(self.results_display, stretch=3)

        # Skill icons panel on the right
        self.skills_panel = QWidget()
        skills_panel_layout = QVBoxLayout()
        skills_panel_layout.setAlignment(Qt.AlignmentFlag.AlignTop)

        # Title for skills panel
        skills_title = QLabel("Skills")
        skills_title.setStyleSheet("font-weight: bold; font-size: 14px;")
        skills_title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        skills_panel_layout.addWidget(skills_title)

        # Scroll area for skill icons
        self.skills_scroll = QScrollArea()
        self.skills_scroll.setWidgetResizable(True)
        self.skills_scroll.setMinimumWidth(250)
        self.skills_scroll.setMaximumWidth(400)

        # Container for skill icons
        self.skills_container = QWidget()
        self.skills_container_layout = QVBoxLayout()
        self.skills_container_layout.setAlignment(Qt.AlignmentFlag.AlignTop)
        self.skills_container.setLayout(self.skills_container_layout)
        self.skills_scroll.setWidget(self.skills_container)

        skills_panel_layout.addWidget(self.skills_scroll)
        self.skills_panel.setLayout(skills_panel_layout)
        results_layout.addWidget(self.skills_panel, stretch=1)

        layout.addLayout(results_layout, stretch=1)

    def _search_boss(self):
        """Search for boss by exact name"""
        try:
            search_name = self.name_input.text().strip()

            if not search_name:
                self.status_label.setText("Please enter a boss name")
                return

            self.results_display.clear()
            self.status_label.setText(f"Searching for '{search_name}'...")
            QApplication.processEvents()

            # Use BossFinderV2
            self.boss_finder = BossFinderV2(BYTES_FOLDER)
            results = self.boss_finder.search_boss_by_name(search_name)

            if not results:
                self.status_label.setText("No results found")
                self.selector_widget.hide()
                self.filter_widget.hide()
                self.results_display.clear()
                self.all_results = []
                self.current_results = []
                return

            # Store all results and cache system text
            self.all_results = results
            self.system_text_index = self.boss_finder._get_system_text_index()

            # Pre-compute translated mode and dungeon for each result
            for result in self.all_results:
                dungeon = result.get('dungeon', {})
                area = result.get('area')
                dungeon_mode = dungeon.get('DungeonMode', '')
                dungeon_name = dungeon.get('SeasonFullName', '')

                # Translate mode
                if dungeon_mode:
                    mode_text_key = self.boss_finder._get_dungeon_mode_text(dungeon_mode, area)
                    mode_localized = self.boss_finder._get_localized_text(mode_text_key, self.system_text_index)
                    result['_mode_en'] = mode_localized.get('en', mode_text_key)
                else:
                    result['_mode_en'] = ''

                # Translate dungeon name
                if dungeon_name:
                    dungeon_name_localized = self.boss_finder._get_localized_text(dungeon_name, self.system_text_index)
                    result['_dungeon_en'] = dungeon_name_localized.get('en', dungeon_name)
                else:
                    result['_dungeon_en'] = ''

            # Populate filter dropdowns
            self._populate_filters()

            # Apply filters (initially no filter = show all)
            self._apply_filters()

            # Show filter widget
            self.filter_widget.show()

            self.status_label.setText(f"Found {len(results)} result(s)")
            logger.info(f"Found {len(results)} boss(es) matching '{search_name}'")

        except Exception as e:
            logger.exception("Error searching for boss")
            QMessageBox.critical(self, "Error", f"Failed to search for boss:\n{str(e)}")
            self.status_label.setText("[ERROR] Search failed")
            self.results_display.setText(f"Error: {str(e)}")

    def _populate_filters(self):
        """Populate mode and dungeon filter dropdowns from all results"""
        # Collect unique modes and dungeons
        modes = set()
        dungeons = set()

        for result in self.all_results:
            mode_en = result.get('_mode_en', '')
            dungeon_en = result.get('_dungeon_en', '')
            if mode_en:
                modes.add(mode_en)
            if dungeon_en:
                dungeons.add(dungeon_en)

        # Block signals during population
        self.mode_filter.blockSignals(True)
        self.dungeon_filter.blockSignals(True)

        # Clear and populate mode filter
        self.mode_filter.clear()
        self.mode_filter.addItem("All Modes", "")  # Empty string = no filter
        for mode in sorted(modes):
            self.mode_filter.addItem(mode, mode)

        # Clear and populate dungeon filter
        self.dungeon_filter.clear()
        self.dungeon_filter.addItem("All Dungeons", "")  # Empty string = no filter
        for dungeon in sorted(dungeons):
            self.dungeon_filter.addItem(dungeon, dungeon)

        self.mode_filter.blockSignals(False)
        self.dungeon_filter.blockSignals(False)

    def _on_filter_changed(self):
        """Handle filter selection change"""
        self._apply_filters()

    def _apply_filters(self):
        """Apply mode and dungeon filters to results"""
        # Get selected filter values
        selected_mode = self.mode_filter.currentData() or ""
        selected_dungeon = self.dungeon_filter.currentData() or ""

        # Filter results
        filtered = []
        for result in self.all_results:
            mode_en = result.get('_mode_en', '')
            dungeon_en = result.get('_dungeon_en', '')

            # Check mode filter
            if selected_mode and mode_en != selected_mode:
                continue

            # Check dungeon filter
            if selected_dungeon and dungeon_en != selected_dungeon:
                continue

            filtered.append(result)

        self.current_results = filtered

        # Update result selector
        self._populate_result_selector()

        # Update status
        if selected_mode or selected_dungeon:
            self.status_label.setText(f"Showing {len(filtered)} of {len(self.all_results)} result(s)")
        else:
            self.status_label.setText(f"Found {len(self.all_results)} result(s)")

    def _populate_result_selector(self):
        """Populate the result selector with current filtered results"""
        self.result_selector.blockSignals(True)
        self.result_selector.clear()

        for idx, result in enumerate(self.current_results):
            name = result.get('name', 'Unknown')
            nickname = result.get('nickname', '')
            monster_id = result.get('monster_id', '')
            level = result.get('spawn_level', '?')
            mode_en = result.get('_mode_en', '')
            dungeon_en = result.get('_dungeon_en', '')

            # Format: {nickname} name (ID / Lv) - {mode} - {dungeon}
            display_parts = []

            if nickname:
                display_parts.append(f"{nickname} {name}")
            else:
                display_parts.append(name)

            display_parts.append(f"({monster_id} / Lv{level})")

            if mode_en:
                display_parts.append(mode_en)

            if dungeon_en:
                display_parts.append(dungeon_en)

            display_text = " - ".join(display_parts)
            self.result_selector.addItem(display_text, idx)

        self.result_selector.blockSignals(False)

        if self.current_results:
            self.selector_widget.show()
            self._display_result(0)
        else:
            self.selector_widget.hide()
            self.results_display.clear()
            # Clear skill icons
            while self.skills_container_layout.count():
                child = self.skills_container_layout.takeAt(0)
                if child.widget():
                    child.widget().deleteLater()

    def _on_result_selected(self, index):
        """Handle result selection"""
        if index >= 0 and index < len(self.current_results):
            self._display_result(index)

    def _display_result(self, index):
        """Display a specific result"""
        if not self.current_results or index < 0 or index >= len(self.current_results):
            return

        try:
            self.current_selected_index = index
            result = self.current_results[index]

            # Format and display text
            formatted = self.boss_finder.format_results_text([result])
            self.results_display.setText(formatted)

            # Display skill icons
            self._display_skill_icons(result)

        except Exception as e:
            logger.exception(f"Error displaying result {index}")
            self.results_display.setText(f"Error displaying result: {str(e)}")

    def _display_skill_icons(self, result):
        """Display skill icons in the right panel"""
        # Clear existing icons
        while self.skills_container_layout.count():
            child = self.skills_container_layout.takeAt(0)
            if child.widget():
                child.widget().deleteLater()

        # Base path for sprite images
        # BYTES_FOLDER is like: .../extracted_astudio/assets/editor/resources/templetbinary
        # We need: .../extracted_astudio/assets/editor/resources/sprite
        sprite_path = os.path.join(
            os.path.dirname(BYTES_FOLDER),
            'sprite'
        )

        # Display portrait images (Turn and MT)
        model_id = result.get('model_id', '')
        if model_id:
            # Check if it's a character (starts with "2") or monster
            is_character = model_id.startswith('2')

            # Create portrait container
            portrait_widget = QWidget()
            portrait_layout = QVBoxLayout()
            portrait_layout.setContentsMargins(5, 5, 5, 15)
            portrait_layout.setAlignment(Qt.AlignmentFlag.AlignCenter)

            # Add portrait label
            portrait_title = QLabel("Portrait")
            portrait_title.setStyleSheet("font-weight: bold; font-size: 12px;")
            portrait_title.setAlignment(Qt.AlignmentFlag.AlignCenter)
            portrait_layout.addWidget(portrait_title)

            if is_character:
                # Character: Display IG_Turn_{icons}_E.png
                turn_path = os.path.join(sprite_path, f"IG_Turn_{model_id}_E.png")
                if os.path.exists(turn_path):
                    pixmap = QPixmap(turn_path)
                    if not pixmap.isNull():
                        scaled_pixmap = pixmap.scaled(
                            150, 150,
                            Qt.AspectRatioMode.KeepAspectRatio,
                            Qt.TransformationMode.SmoothTransformation
                        )
                        img_label = QLabel()
                        img_label.setPixmap(scaled_pixmap)
                        img_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
                        portrait_layout.addWidget(img_label)
            else:
                # Monster: Display IG_Turn_{icons}.png and MT_{icons}.png
                turn_path = os.path.join(sprite_path, f"IG_Turn_{model_id}.png")
                mt_path = os.path.join(sprite_path, f"MT_{model_id}.png")

                if os.path.exists(turn_path):
                    pixmap = QPixmap(turn_path)
                    if not pixmap.isNull():
                        scaled_pixmap = pixmap.scaled(
                            150, 150,
                            Qt.AspectRatioMode.KeepAspectRatio,
                            Qt.TransformationMode.SmoothTransformation
                        )
                        turn_label = QLabel()
                        turn_label.setPixmap(scaled_pixmap)
                        turn_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
                        portrait_layout.addWidget(turn_label)

                if os.path.exists(mt_path):
                    pixmap = QPixmap(mt_path)
                    if not pixmap.isNull():
                        scaled_pixmap = pixmap.scaled(
                            150, 150,
                            Qt.AspectRatioMode.KeepAspectRatio,
                            Qt.TransformationMode.SmoothTransformation
                        )
                        mt_label = QLabel()
                        mt_label.setPixmap(scaled_pixmap)
                        mt_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
                        portrait_layout.addWidget(mt_label)

            portrait_widget.setLayout(portrait_layout)
            self.skills_container_layout.addWidget(portrait_widget)

            # Add separator
            separator = QLabel("─" * 30)
            separator.setAlignment(Qt.AlignmentFlag.AlignCenter)
            separator.setStyleSheet("color: #888;")
            self.skills_container_layout.addWidget(separator)

        # Get skills from result
        skills = result.get('skills', [])
        if not skills:
            no_skills_label = QLabel("No skills found")
            no_skills_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
            self.skills_container_layout.addWidget(no_skills_label)
            return

        # Display each skill
        for skill in skills:
            icon_name = skill.get('icon_name', '')
            skill_name = skill.get('name', {})
            skill_name_en = skill_name.get('en', 'Unknown') if isinstance(skill_name, dict) else 'Unknown'

            # Create skill widget
            skill_widget = QWidget()
            skill_layout = QVBoxLayout()
            skill_layout.setContentsMargins(5, 5, 5, 5)

            # Icon
            if icon_name:
                icon_path = os.path.join(sprite_path, f"{icon_name}.png")
                if os.path.exists(icon_path):
                    # Load and display image
                    pixmap = QPixmap(icon_path)
                    if not pixmap.isNull():
                        # Scale to reasonable size (e.g., 64x64)
                        scaled_pixmap = pixmap.scaled(
                            64, 64,
                            Qt.AspectRatioMode.KeepAspectRatio,
                            Qt.TransformationMode.SmoothTransformation
                        )
                        icon_label = QLabel()
                        icon_label.setPixmap(scaled_pixmap)
                        icon_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
                        skill_layout.addWidget(icon_label)
                    else:
                        # Failed to load image
                        error_label = QLabel(f"[Failed to load icon]")
                        error_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
                        skill_layout.addWidget(error_label)
                else:
                    # Icon file not found
                    error_label = QLabel(f"[Icon not found:\n{icon_name}]")
                    error_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
                    error_label.setWordWrap(True)
                    skill_layout.addWidget(error_label)
            else:
                # No icon name
                error_label = QLabel("[No icon]")
                error_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
                skill_layout.addWidget(error_label)

            # Skill name
            name_label = QLabel(skill_name_en)
            name_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
            name_label.setWordWrap(True)
            name_label.setStyleSheet("font-size: 11px;")
            skill_layout.addWidget(name_label)

            skill_widget.setLayout(skill_layout)
            self.skills_container_layout.addWidget(skill_widget)

        # Add spacer at the end to push everything to the top
        self.skills_container_layout.addStretch()

    def _extract_current_boss(self):
        """Extract current boss data to JSON and copy images"""
        import json
        import shutil
        from pathlib import Path

        if not self.current_results or self.current_selected_index < 0:
            QMessageBox.warning(self, "No Selection", "Please select a boss result first")
            return

        result = self.current_results[self.current_selected_index]
        monster_id = result.get('monster_id', '')
        model_id = result.get('model_id', '')

        if not monster_id:
            QMessageBox.warning(self, "Error", "No monster ID found")
            return

        # Paths
        json_path = BOSS_DATA / f'{monster_id}.json'
        skill_img_dir = BOSS_SKILL_IMAGE_FOLDER
        mini_img_dir = BOSS_MINI_IMAGE_FOLDER
        portrait_img_dir = BOSS_PORTRAIT_IMAGE_FOLDER
        sprite_dir = SPRITE_SOURCE_FOLDER

        # Check if JSON already exists
        if json_path.exists():
            reply = QMessageBox.question(
                self,
                "File Exists",
                f"Boss {monster_id}.json already exists. Overwrite?",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
            )
            if reply == QMessageBox.StandardButton.No:
                return

        try:
            # Create directories
            json_path.parent.mkdir(parents=True, exist_ok=True)
            skill_img_dir.mkdir(parents=True, exist_ok=True)
            mini_img_dir.mkdir(parents=True, exist_ok=True)
            portrait_img_dir.mkdir(parents=True, exist_ok=True)

            # Generate JSON
            json_data = self.boss_finder.format_results_json([result])
            if json_data:
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(json_data[0], f, indent=2, ensure_ascii=False)

            copied_files = []
            skipped_files = []

            # Copy skill icons
            skills = result.get('skills', [])
            for skill in skills:
                icon_name = skill.get('icon_name', '')
                if icon_name:
                    src = sprite_dir / f'{icon_name}.png'
                    dst = skill_img_dir / f'{icon_name}.png'
                    if src.exists():
                        if not dst.exists():
                            shutil.copy2(src, dst)
                            copied_files.append(f'skill/{icon_name}.png')
                        else:
                            skipped_files.append(f'skill/{icon_name}.png')

            # Copy portrait images
            if model_id:
                is_character = model_id.startswith('2')

                if is_character:
                    # Character: IG_Turn_{FaceIconID}_E.png
                    turn_src = sprite_dir / f'IG_Turn_{model_id}_E.png'
                    turn_dst = mini_img_dir / f'IG_Turn_{model_id}_E.png'
                    if turn_src.exists():
                        if not turn_dst.exists():
                            shutil.copy2(turn_src, turn_dst)
                            copied_files.append(f'mini/IG_Turn_{model_id}_E.png')
                        else:
                            skipped_files.append(f'mini/IG_Turn_{model_id}_E.png')
                else:
                    # Monster: IG_Turn_{FaceIconID}.png
                    turn_src = sprite_dir / f'IG_Turn_{model_id}.png'
                    turn_dst = mini_img_dir / f'IG_Turn_{model_id}.png'
                    if turn_src.exists():
                        if not turn_dst.exists():
                            shutil.copy2(turn_src, turn_dst)
                            copied_files.append(f'mini/IG_Turn_{model_id}.png')
                        else:
                            skipped_files.append(f'mini/IG_Turn_{model_id}.png')

                    # Monster: MT_{FaceIconID}.png
                    mt_src = sprite_dir / f'MT_{model_id}.png'
                    mt_dst = portrait_img_dir / f'MT_{model_id}.png'
                    if mt_src.exists():
                        if not mt_dst.exists():
                            shutil.copy2(mt_src, mt_dst)
                            copied_files.append(f'portrait/MT_{model_id}.png')
                        else:
                            skipped_files.append(f'portrait/MT_{model_id}.png')

            # Show success message
            message = f"Extraction complete!\n\n"
            message += f"JSON saved to: {json_path.name}\n\n"
            message += f"Copied {len(copied_files)} file(s)\n"
            if skipped_files:
                message += f"Skipped {len(skipped_files)} existing file(s)\n"

            QMessageBox.information(self, "Success", message)

        except Exception as e:
            QMessageBox.critical(self, "Error", f"Extraction failed:\n{str(e)}")


class BuffValidatorTab(QWidget):
    """Tab for validating buff and debuff usage"""

    def __init__(self):
        super().__init__()
        self.validator = BuffValidator()
        self.results = None
        self._setup_ui()

    def _setup_ui(self):
        """Setup the Buff Validator UI"""
        layout = QVBoxLayout(self)

        # Header
        header_label = QLabel("<h2>Buff/Debuff Validator</h2>")
        header_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(header_label)

        # Description
        desc_label = QLabel(
            "This tool scans all character JSON files to find:\n"
            "- Buffs/debuffs used in characters but not defined in buffs.json/debuffs.json\n"
            "- Buffs/debuffs defined but not used in any character"
        )
        desc_label.setWordWrap(True)
        layout.addWidget(desc_label)

        # Action buttons
        button_layout = QHBoxLayout()

        self.validate_btn = QPushButton("Find Useless Buffs")
        self.validate_btn.clicked.connect(self._run_validation)
        button_layout.addWidget(self.validate_btn)

        self.sort_btn = QPushButton("Sort Buffs/Debuffs")
        self.sort_btn.clicked.connect(self._sort_files)
        button_layout.addWidget(self.sort_btn)

        self.cleanup_btn = QPushButton("Cleanup Selected")
        self.cleanup_btn.clicked.connect(self._show_cleanup_dialog)
        self.cleanup_btn.setEnabled(False)
        button_layout.addWidget(self.cleanup_btn)

        self.export_btn = QPushButton("Export Results")
        self.export_btn.clicked.connect(self._export_results)
        self.export_btn.setEnabled(False)
        button_layout.addWidget(self.export_btn)

        button_layout.addStretch()
        layout.addLayout(button_layout)

        # Status label
        self.status_label = QLabel("Ready. Click 'Find Useless Buffs' to start.")
        layout.addWidget(self.status_label)

        # Results text area
        self.results_text = QTextEdit()
        self.results_text.setReadOnly(True)
        self.results_text.setFont(QApplication.font())
        layout.addWidget(self.results_text)

    def _run_validation(self):
        """Run the buff/debuff validation"""
        try:
            self.status_label.setText("Loading buff/debuff definitions...")
            QApplication.processEvents()

            # Load definitions
            self.validator.load_definitions()

            self.status_label.setText("Scanning character files...")
            QApplication.processEvents()

            # Scan character files
            self.results = self.validator.scan_character_files()

            # Format and display results
            results_text = self.validator.format_results_text(self.results)
            self.results_text.setPlainText(results_text)

            # Update status
            undefined_count = len(self.results['undefined_buffs']) + len(self.results['undefined_debuffs'])
            unused_count = len(self.results['unused_buffs']) + len(self.results['unused_debuffs'])

            self.status_label.setText(
                f"[OK] Validation complete: {undefined_count} undefined, {unused_count} unused"
            )

            # Enable buttons
            self.export_btn.setEnabled(True)
            # Only enable cleanup if there are undefined buffs/debuffs
            has_undefined = (len(self.results['undefined_buffs_details']) > 0 or
                           len(self.results['undefined_debuffs_details']) > 0)
            self.cleanup_btn.setEnabled(has_undefined)

        except Exception as e:
            logger.exception("Error running validation")
            QMessageBox.critical(self, "Error", f"Failed to run validation:\n{str(e)}")
            self.status_label.setText("[ERROR] Validation failed")

    def _sort_files(self):
        """Sort buffs.json and debuffs.json by name"""
        try:
            # Confirmation dialog
            reply = QMessageBox.question(
                self,
                "Sort Buffs/Debuffs",
                "This will sort buffs.json and debuffs.json by name.\n\n"
                "Files will be modified. Continue?",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No
            )

            if reply != QMessageBox.StandardButton.Yes:
                return

            self.status_label.setText("Sorting buffs/debuffs files...")
            QApplication.processEvents()

            # Sort files
            result = self.validator.sort_buffs_debuffs_files()

            if result['success']:
                QMessageBox.information(
                    self,
                    "Success",
                    result['message']
                )
                self.status_label.setText(
                    f"[OK] Sorted {result['buffs_count']} buffs and {result['debuffs_count']} debuffs"
                )
            else:
                QMessageBox.critical(self, "Error", result['message'])
                self.status_label.setText("[ERROR] Failed to sort files")

        except Exception as e:
            logger.exception("Error sorting files")
            QMessageBox.critical(self, "Error", f"Failed to sort files:\n{str(e)}")
            self.status_label.setText("[ERROR] Sort failed")

    def _export_results(self):
        """Export validation results to a text file"""
        if not self.results:
            QMessageBox.warning(self, "Warning", "No results to export. Run validation first.")
            return

        try:
            # Export to ParserV3 folder
            export_path = Path(__file__).parent / "buff_validation_results.txt"

            results_text = self.validator.format_results_text(self.results)

            with open(export_path, 'w', encoding='utf-8') as f:
                f.write(results_text)

            QMessageBox.information(
                self,
                "Export Successful",
                f"Results exported to:\n{export_path}"
            )
            logger.info(f"Validation results exported to {export_path}")

        except Exception as e:
            logger.exception("Error exporting results")
            QMessageBox.critical(self, "Error", f"Failed to export results:\n{str(e)}")

    def _show_cleanup_dialog(self):
        """Show dialog to select buffs/debuffs to cleanup"""
        if not self.results:
            QMessageBox.warning(self, "Warning", "No results available. Run validation first.")
            return

        # Create and show cleanup dialog
        dialog = BuffCleanupDialog(self.results, self.validator, self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            # Re-run validation after cleanup
            self._run_validation()


class BuffCleanupDialog(QDialog):
    """Dialog for selecting and cleaning up undefined buffs/debuffs"""

    def __init__(self, results: Dict, validator: BuffValidator, parent=None):
        super().__init__(parent)
        self.results = results
        self.validator = validator
        self.selected_items = []
        self.setWindowTitle("Cleanup Undefined Buffs/Debuffs")
        self.setMinimumSize(800, 600)
        self._setup_ui()

    def _setup_ui(self):
        """Setup the cleanup dialog UI"""
        layout = QVBoxLayout(self)

        # Header
        header_label = QLabel("<h2>Select Items to Remove</h2>")
        header_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(header_label)

        # Warning label
        warning_label = QLabel(
            "WARNING: This will permanently modify your JSON files!\n"
            "Make sure you have a backup or use version control before proceeding."
        )
        warning_label.setWordWrap(True)
        warning_label.setStyleSheet("color: #ff6b6b; font-weight: bold; padding: 10px;")
        layout.addWidget(warning_label)

        # Table for selection
        self.table = QTableWidget()
        self.table.setColumnCount(5)
        self.table.setHorizontalHeaderLabels(["Select", "Type", "Name", "Character", "Skill"])
        self.table.horizontalHeader().setStretchLastSection(False)
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeMode.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(4, QHeaderView.ResizeMode.ResizeToContents)
        self.table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.table.setAlternatingRowColors(True)

        # Populate table
        self._populate_table()

        layout.addWidget(self.table)

        # Selection buttons
        selection_layout = QHBoxLayout()

        select_all_btn = QPushButton("Select All")
        select_all_btn.clicked.connect(self._select_all)
        selection_layout.addWidget(select_all_btn)

        deselect_all_btn = QPushButton("Deselect All")
        deselect_all_btn.clicked.connect(self._deselect_all)
        selection_layout.addWidget(deselect_all_btn)

        selection_layout.addStretch()
        layout.addLayout(selection_layout)

        # Action buttons
        button_layout = QHBoxLayout()

        self.cleanup_btn = QPushButton("Cleanup Selected Items")
        self.cleanup_btn.clicked.connect(self._perform_cleanup)
        button_layout.addWidget(self.cleanup_btn)

        cancel_btn = QPushButton("Cancel")
        cancel_btn.clicked.connect(self.reject)
        button_layout.addWidget(cancel_btn)

        layout.addLayout(button_layout)

    def _populate_table(self):
        """Populate the table with undefined buffs/debuffs"""
        # Combine buffs and debuffs
        items = []

        # Add undefined buffs
        for item in self.results['undefined_buffs_details']:
            items.append({
                'type': 'Buff',
                'name': item['buff'],
                'character': item['character'],
                'skill': item['skill'],
                'is_debuff': False
            })

        # Add undefined debuffs
        for item in self.results['undefined_debuffs_details']:
            items.append({
                'type': 'Debuff',
                'name': item['debuff'],
                'character': item['character'],
                'skill': item['skill'],
                'is_debuff': True
            })

        # Remove duplicates (keep first occurrence)
        unique_items = []
        seen = set()
        for item in items:
            key = (item['type'], item['name'])
            if key not in seen:
                seen.add(key)
                unique_items.append(item)

        # Set row count
        self.table.setRowCount(len(unique_items))

        # Populate rows
        for row, item in enumerate(unique_items):
            # Checkbox
            checkbox = QCheckBox()
            checkbox_widget = QWidget()
            checkbox_layout = QHBoxLayout(checkbox_widget)
            checkbox_layout.addWidget(checkbox)
            checkbox_layout.setAlignment(Qt.AlignmentFlag.AlignCenter)
            checkbox_layout.setContentsMargins(0, 0, 0, 0)
            self.table.setCellWidget(row, 0, checkbox_widget)

            # Store item data in checkbox
            checkbox.setProperty("item_data", item)

            # Type
            type_item = QTableWidgetItem(item['type'])
            type_item.setFlags(type_item.flags() & ~Qt.ItemFlag.ItemIsEditable)
            self.table.setItem(row, 1, type_item)

            # Name
            name_item = QTableWidgetItem(item['name'])
            name_item.setFlags(name_item.flags() & ~Qt.ItemFlag.ItemIsEditable)
            self.table.setItem(row, 2, name_item)

            # Character (show first occurrence)
            char_item = QTableWidgetItem(item['character'])
            char_item.setFlags(char_item.flags() & ~Qt.ItemFlag.ItemIsEditable)
            self.table.setItem(row, 3, char_item)

            # Skill (show first occurrence)
            skill_item = QTableWidgetItem(item['skill'])
            skill_item.setFlags(skill_item.flags() & ~Qt.ItemFlag.ItemIsEditable)
            self.table.setItem(row, 4, skill_item)

    def _select_all(self):
        """Select all checkboxes"""
        for row in range(self.table.rowCount()):
            checkbox_widget = self.table.cellWidget(row, 0)
            checkbox = checkbox_widget.findChild(QCheckBox)
            if checkbox:
                checkbox.setChecked(True)

    def _deselect_all(self):
        """Deselect all checkboxes"""
        for row in range(self.table.rowCount()):
            checkbox_widget = self.table.cellWidget(row, 0)
            checkbox = checkbox_widget.findChild(QCheckBox)
            if checkbox:
                checkbox.setChecked(False)

    def _perform_cleanup(self):
        """Perform cleanup of selected items"""
        # Collect selected items
        selected_items = []
        for row in range(self.table.rowCount()):
            checkbox_widget = self.table.cellWidget(row, 0)
            checkbox = checkbox_widget.findChild(QCheckBox)
            if checkbox and checkbox.isChecked():
                item_data = checkbox.property("item_data")
                selected_items.append(item_data)

        if not selected_items:
            QMessageBox.warning(self, "Warning", "No items selected for cleanup.")
            return

        # Confirm action
        reply = QMessageBox.question(
            self,
            "Confirm Cleanup",
            f"Are you sure you want to remove {len(selected_items)} item(s) from all character files?\n\n"
            "This action will modify JSON files and cannot be undone!",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No
        )

        if reply != QMessageBox.StandardButton.Yes:
            return

        # Perform cleanup
        try:
            cleanup_results = []

            progress = QProgressDialog("Cleaning up files...", "Cancel", 0, len(selected_items), self)
            progress.setWindowModality(Qt.WindowModality.WindowModal)

            for i, item in enumerate(selected_items):
                if progress.wasCanceled():
                    break

                progress.setValue(i)
                progress.setLabelText(f"Removing {item['type']}: {item['name']}...")
                QApplication.processEvents()

                result = self.validator.remove_buff_from_files(item['name'], item['is_debuff'])
                cleanup_results.append(result)

            progress.setValue(len(selected_items))

            # Show cleanup report
            report = self.validator.format_cleanup_report(cleanup_results)

            # Create report dialog
            report_dialog = QDialog(self)
            report_dialog.setWindowTitle("Cleanup Report")
            report_dialog.setMinimumSize(700, 500)

            report_layout = QVBoxLayout(report_dialog)

            report_text = QTextEdit()
            report_text.setReadOnly(True)
            report_text.setPlainText(report)
            report_layout.addWidget(report_text)

            # Export report button
            export_layout = QHBoxLayout()
            export_report_btn = QPushButton("Export Report")
            export_report_btn.clicked.connect(lambda: self._export_cleanup_report(report))
            export_layout.addWidget(export_report_btn)

            close_btn = QPushButton("Close")
            close_btn.clicked.connect(report_dialog.accept)
            export_layout.addWidget(close_btn)

            report_layout.addLayout(export_layout)

            report_dialog.exec()

            # Accept dialog to trigger re-validation
            self.accept()

        except Exception as e:
            logger.exception("Error during cleanup")
            QMessageBox.critical(self, "Error", f"Failed to perform cleanup:\n{str(e)}")

    def _export_cleanup_report(self, report: str):
        """Export cleanup report to a text file"""
        try:
            export_path = Path(__file__).parent / "buff_cleanup_report.txt"

            with open(export_path, 'w', encoding='utf-8') as f:
                f.write(report)

            QMessageBox.information(
                self,
                "Export Successful",
                f"Cleanup report exported to:\n{export_path}"
            )
            logger.info(f"Cleanup report exported to {export_path}")

        except Exception as e:
            logger.exception("Error exporting cleanup report")
            QMessageBox.critical(self, "Error", f"Failed to export report:\n{str(e)}")


def calculate_text_similarity(text1, text2):
    """Calculate simple similarity ratio between two texts (Jaccard similarity)"""
    if not text1 or not text2:
        return 0.0

    # Normalize texts: lowercase, remove extra spaces, punctuation
    import string
    translator = str.maketrans('', '', string.punctuation)
    t1 = ' '.join(text1.lower().translate(translator).split())
    t2 = ' '.join(text2.lower().translate(translator).split())

    # Simple word-based Jaccard similarity
    words1 = set(t1.split())
    words2 = set(t2.split())

    if not words1 or not words2:
        return 0.0

    intersection = words1.intersection(words2)
    union = words1.union(words2)

    return len(intersection) / len(union) if union else 0.0


class BuffReviewDialog(QDialog):
    """Dialog for reviewing and applying buff/debuff translations one by one"""

    def __init__(self, buff_data, debuff_data, suffix, parent=None):
        super().__init__(parent)
        self.buff_data = buff_data
        self.debuff_data = debuff_data
        self.suffix = suffix

        # Build list of items with translations
        self.items_to_review = []
        for buff in buff_data:
            if buff.get("matched") or buff.get("found_label_translation") or buff.get("found_description_translation"):
                self.items_to_review.append(("Buff", buff))
        for debuff in debuff_data:
            if debuff.get("matched") or debuff.get("found_label_translation") or debuff.get("found_description_translation"):
                self.items_to_review.append(("Debuff", debuff))

        self.current_index = 0
        self.applied_items = []
        self.cancelled = False

        self.setWindowTitle(f"Review Buff/Debuff Translations ({suffix})")
        self.setMinimumSize(700, 600)
        self._setup_ui()
        self._display_current_item()

    def _setup_ui(self):
        """Setup the review dialog UI"""
        layout = QVBoxLayout(self)

        # Progress info
        self.progress_label = QLabel()
        self.progress_label.setStyleSheet("font-weight: bold; font-size: 12pt;")
        layout.addWidget(self.progress_label)

        # Match status indicator
        self.match_status_label = QLabel()
        self.match_status_label.setStyleSheet("font-weight: bold; font-size: 11pt; padding: 5px;")
        self.match_status_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(self.match_status_label)

        # Separator
        layout.addWidget(QLabel("─" * 80))

        # Data Live section
        live_group = QGroupBox()
        live_group.setStyleSheet("QGroupBox { font-weight: bold; font-size: 11pt; }")
        live_layout = QFormLayout()

        self.live_type_label = QLabel()
        self.live_name_label = QLabel()
        self.live_name_label.setStyleSheet("font-family: monospace;")
        self.live_label_label = QLabel()
        self.live_label_label.setWordWrap(True)
        self.live_desc_label = QLabel()
        self.live_desc_label.setWordWrap(True)

        live_layout.addRow("<b>Type:</b>", self.live_type_label)
        live_layout.addRow("<b>Name:</b>", self.live_name_label)
        live_layout.addRow("<b>Label:</b>", self.live_label_label)
        live_layout.addRow("<b>Description:</b>", self.live_desc_label)

        live_group.setLayout(live_layout)
        live_group.setTitle("=== Data Live ===")
        layout.addWidget(live_group)

        # Data Found section
        found_group = QGroupBox()
        found_group.setStyleSheet("QGroupBox { font-weight: bold; font-size: 11pt; }")
        found_layout = QFormLayout()

        self.found_label_en = QLabel()
        self.found_label_en.setWordWrap(True)
        self.found_desc_en = QLabel()
        self.found_desc_en.setWordWrap(True)
        self.found_label_loc = QLabel()
        self.found_label_loc.setWordWrap(True)
        self.found_label_loc.setStyleSheet("color: #0066cc;")
        self.found_desc_loc = QLabel()
        self.found_desc_loc.setWordWrap(True)
        self.found_desc_loc.setStyleSheet("color: #0066cc;")

        found_layout.addRow("<b>Label (EN):</b>", self.found_label_en)
        found_layout.addRow("<b>Description (EN):</b>", self.found_desc_en)
        found_layout.addRow(f"<b>Label{self.suffix}:</b>", self.found_label_loc)
        found_layout.addRow(f"<b>Description{self.suffix}:</b>", self.found_desc_loc)

        found_group.setLayout(found_layout)
        found_group.setTitle("=== Data Found ===")
        layout.addWidget(found_group)

        layout.addStretch()

        # Buttons
        button_layout = QHBoxLayout()

        skip_btn = QPushButton("Skip")
        skip_btn.clicked.connect(self._skip_item)
        skip_btn.setStyleSheet("padding: 10px 20px; font-size: 10pt;")
        button_layout.addWidget(skip_btn)

        button_layout.addStretch()

        cancel_btn = QPushButton("Cancel")
        cancel_btn.clicked.connect(self._cancel_all)
        cancel_btn.setStyleSheet("padding: 10px 20px; font-size: 10pt;")
        button_layout.addWidget(cancel_btn)

        apply_btn = QPushButton("Apply")
        apply_btn.clicked.connect(self._apply_item)
        apply_btn.setStyleSheet("padding: 10px 20px; font-size: 10pt; background-color: #4CAF50; color: white;")
        apply_btn.setDefault(True)
        button_layout.addWidget(apply_btn)

        layout.addLayout(button_layout)

    def _display_current_item(self):
        """Display the current item being reviewed"""
        if self.current_index >= len(self.items_to_review):
            # All items reviewed
            self.accept()
            return

        item_type, item_data = self.items_to_review[self.current_index]

        # Update progress
        self.progress_label.setText(
            f"Item {self.current_index + 1} of {len(self.items_to_review)}"
        )

        # Data Live
        live_label = item_data.get("label", "")
        live_desc = item_data.get("description", "")

        self.live_type_label.setText(item_type)
        self.live_name_label.setText(item_data.get("name", ""))
        self.live_label_label.setText(live_label)
        self.live_desc_label.setText(live_desc)

        # Data Found
        if item_data.get("matched"):
            # Direct match
            found_label_en = item_data.get("label", "")
            found_desc_en = item_data.get("description", "")
            self.found_label_en.setText(found_label_en)
            self.found_desc_en.setText(found_desc_en)
            self.found_label_loc.setText(item_data.get("found_label_translation", "") or "(not found)")
            self.found_desc_loc.setText(item_data.get("translation", ""))
        else:
            # Tooltip match
            found_label_en = item_data.get("found_label", "") or "(not found)"
            found_desc_en = item_data.get("found_description", "") or "(not found)"
            self.found_label_en.setText(found_label_en)
            self.found_desc_en.setText(found_desc_en)
            self.found_label_loc.setText(item_data.get("found_label_translation", "") or "(not found)")
            self.found_desc_loc.setText(item_data.get("found_description_translation", "") or "(not found)")

        # Check if it's a perfect match
        is_perfect_match = (
            live_label == found_label_en and
            live_desc == found_desc_en and
            found_label_en != "(not found)" and
            found_desc_en != "(not found)"
        )

        if is_perfect_match:
            self.match_status_label.setText("✓ Perfect Match")
            self.match_status_label.setStyleSheet("font-weight: bold; font-size: 11pt; padding: 5px; color: #2e7d32; background-color: #c8e6c9;")
        else:
            self.match_status_label.setText("⚠ Partial Match")
            self.match_status_label.setStyleSheet("font-weight: bold; font-size: 11pt; padding: 5px; color: #f57c00; background-color: #ffe0b2;")

    def _skip_item(self):
        """Skip current item and move to next"""
        self.current_index += 1
        self._display_current_item()

    def _reorder_buff_debuff_keys(self, item):
        """Reorder keys in buff/debuff item to maintain consistent order"""
        # Define the desired key order
        key_order = [
            "name",
            "category",
            "group",
            "label",
            "label_jp",
            "label_kr",
            "label_zh",
            "description",
            "description_jp",
            "description_kr",
            "description_zh",
            "icon"
        ]

        # Create new ordered dict
        ordered_item = {}

        # Add keys in the specified order if they exist
        for key in key_order:
            if key in item:
                ordered_item[key] = item[key]

        # Add any remaining keys that weren't in the order list
        for key, value in item.items():
            if key not in ordered_item:
                ordered_item[key] = value

        return ordered_item

    def _apply_item(self):
        """Apply current item immediately to JSON file and move to next"""
        item_type, item_data = self.items_to_review[self.current_index]
        item_name = item_data.get("name", "")

        try:
            # Determine which file to update
            if item_type == "Buff":
                json_path = BUFFS_FILE
            else:  # Debuff
                json_path = DEBUFFS_FILE

            # Load current JSON data
            with open(json_path, 'r', encoding='utf-8') as f:
                json_data = json.load(f)

            # Find and update the item
            label_key = f"label{self.suffix}"
            desc_key = f"description{self.suffix}"

            for i, json_item in enumerate(json_data):
                if json_item.get("name") == item_name:
                    # Apply label translation if found
                    if item_data.get("found_label_translation"):
                        json_item[label_key] = item_data["found_label_translation"]

                    # Apply description translation
                    if item_data.get("matched"):
                        # Direct match
                        json_item[desc_key] = item_data["translation"]
                    elif item_data.get("found_description_translation"):
                        # Tooltip match
                        json_item[desc_key] = item_data["found_description_translation"]

                    # Reorder keys to maintain consistent order
                    json_data[i] = self._reorder_buff_debuff_keys(json_item)
                    break

            # Save immediately
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(json_data, f, indent=2, ensure_ascii=False)

            # Track applied items for reporting
            self.applied_items.append({
                "type": item_type,
                "name": item_name,
                "data": item_data
            })

            logger.info(f"Applied translation for {item_type}: {item_name}")

        except Exception as e:
            logger.exception(f"Error applying translation for {item_name}")
            QMessageBox.critical(
                self,
                "Error",
                f"Failed to apply translation for {item_name}:\n{str(e)}"
            )
            return

        # Move to next item
        self.current_index += 1
        self._display_current_item()

    def _cancel_all(self):
        """Cancel the entire review process"""
        self.cancelled = True
        self.reject()

    def get_applied_items(self):
        """Get list of items that were applied"""
        return self.applied_items if not self.cancelled else []


class LocalizationTab(QWidget):
    """Tab for extracting and merging localization texts from .bytes to character JSON files"""

    # Language suffix and field mapping
    LANGUAGE_CONFIG = {
        "Chinese Simplified": {
            "suffix": "_zh",
            "bytes_field": "China_Simplified"
        }
    }

    def __init__(self):
        super().__init__()
        self.current_char_id = None
        self.extracted_loc_data = None  # Data extracted from .bytes
        self.current_char_json = None  # Current character/EE JSON
        self.current_language = "Chinese Simplified"
        self.current_type = "Character"  # "Character" or "EE"
        self._setup_ui()
        self._load_character_list()

    def _setup_ui(self):
        """Setup the Localization UI"""
        main_layout = QVBoxLayout(self)

        # Top panel: Controls
        top_panel = QWidget()
        top_layout = QHBoxLayout(top_panel)

        # Type selection (Character or EE)
        type_group = QGroupBox("Type")
        type_layout = QVBoxLayout()

        self.type_combo = QComboBox()
        self.type_combo.addItems(["Character", "EE", "Buff/Debuff"])
        self.type_combo.currentTextChanged.connect(self._on_type_changed)
        type_layout.addWidget(self.type_combo)

        type_group.setLayout(type_layout)
        top_layout.addWidget(type_group)

        # Language selection
        lang_group = QGroupBox("Language Settings")
        lang_layout = QFormLayout()

        self.language_combo = QComboBox()
        self.language_combo.addItems(list(self.LANGUAGE_CONFIG.keys()))
        self.language_combo.currentTextChanged.connect(self._on_language_changed)
        lang_layout.addRow("Target Language:", self.language_combo)

        lang_config = self.LANGUAGE_CONFIG[self.current_language]
        self.suffix_label = QLabel(f"Suffix: {lang_config['suffix']} | Bytes Field: {lang_config['bytes_field']}")
        lang_layout.addRow("", self.suffix_label)

        lang_group.setLayout(lang_layout)
        top_layout.addWidget(lang_group)

        # Character/EE selection
        self.select_group = QGroupBox("Select Character")
        char_layout = QFormLayout()

        self.char_combo = QComboBox()
        self.char_combo.setEditable(True)
        self.char_combo.setInsertPolicy(QComboBox.InsertPolicy.NoInsert)
        self.char_combo.setMaxVisibleItems(20)

        # Add autocomplete with filter
        completer = QCompleter()
        completer.setCaseSensitivity(Qt.CaseSensitivity.CaseInsensitive)
        completer.setCompletionMode(QCompleter.CompletionMode.PopupCompletion)
        completer.setFilterMode(Qt.MatchFlag.MatchContains)
        self.char_combo.setCompleter(completer)

        # Show dropdown on click even when editable
        self.char_combo.lineEdit().installEventFilter(self)

        char_layout.addRow("Character:", self.char_combo)

        self.extract_btn = QPushButton("Extract Localization")
        self.extract_btn.clicked.connect(self._extract_localization)
        char_layout.addRow(self.extract_btn)

        self.select_group.setLayout(char_layout)
        top_layout.addWidget(self.select_group)

        # Actions
        actions_group = QGroupBox("Actions")
        actions_layout = QVBoxLayout()

        # Buff/Debuff extract button (only visible for Buff/Debuff type)
        self.buff_extract_btn = QPushButton("Extract Buff/Debuff Localization")
        self.buff_extract_btn.clicked.connect(self._extract_localization)
        self.buff_extract_btn.setVisible(False)
        actions_layout.addWidget(self.buff_extract_btn)

        # Review button for Buff/Debuff (replaces merge)
        self.buff_review_btn = QPushButton("Review & Apply Translations")
        self.buff_review_btn.setEnabled(False)
        self.buff_review_btn.clicked.connect(self._open_buff_review_dialog)
        self.buff_review_btn.setVisible(False)
        actions_layout.addWidget(self.buff_review_btn)

        self.merge_btn = QPushButton("Merge to JSON")
        self.merge_btn.setEnabled(False)
        self.merge_btn.clicked.connect(self._merge_to_json)
        actions_layout.addWidget(self.merge_btn)

        self.do_all_btn = QPushButton("Do All + Auto Merge")
        self.do_all_btn.clicked.connect(self._do_all_auto_merge)
        actions_layout.addWidget(self.do_all_btn)

        self.char_info_label = QLabel("No character loaded")
        self.char_info_label.setWordWrap(True)
        actions_layout.addWidget(self.char_info_label)

        actions_group.setLayout(actions_layout)
        top_layout.addWidget(actions_group)

        main_layout.addWidget(top_panel)

        # Preview area
        preview_label = QLabel("<b>Extracted Localization Preview:</b>")
        main_layout.addWidget(preview_label)

        self.preview_text = QTextEdit()
        self.preview_text.setReadOnly(True)
        self.preview_text.setFont(QApplication.font())
        main_layout.addWidget(self.preview_text)

    def _load_character_list(self):
        """Load list of characters from existing JSON files in src/data/char/"""
        try:
            logger.info(f"Loading characters from: {CHAR_DATA_FOLDER}")
            logger.info(f"CHAR_DATA_FOLDER exists: {CHAR_DATA_FOLDER.exists()}")

            if not CHAR_DATA_FOLDER.exists():
                error_msg = f"Character data folder not found: {CHAR_DATA_FOLDER}"
                logger.error(error_msg)
                QMessageBox.critical(self, "Error", error_msg)
                return

            char_files = list(CHAR_DATA_FOLDER.glob("*.json"))
            logger.info(f"Found {len(char_files)} JSON files")

            char_list = []

            for file_path in char_files:
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        char_id = data.get("ID", "")
                        fullname = data.get("Fullname", file_path.stem)
                        if char_id:
                            char_list.append({
                                "id": char_id,
                                "name": fullname,
                                "file": file_path.name
                            })
                        else:
                            logger.warning(f"No ID found in {file_path.name}")
                except Exception as e:
                    logger.warning(f"Error reading {file_path}: {e}")
                    continue

            # Sort by name
            char_list.sort(key=lambda x: x["name"])

            # Add to combo and build list for completer
            char_names = []
            for char in char_list:
                display_text = f"{char['name']} (ID: {char['id']})"
                self.char_combo.addItem(display_text, char['id'])
                char_names.append(display_text)

            # Update completer with the list
            completer = self.char_combo.completer()
            if completer:
                from PyQt6.QtCore import QStringListModel
                model = QStringListModel(char_names)
                completer.setModel(model)

            logger.info(f"Loaded {len(char_list)} characters into combo box")

        except Exception as e:
            logger.exception("Error loading character list")
            QMessageBox.critical(self, "Error", f"Failed to load character list:\n{str(e)}")

    def _load_ee_list(self):
        """Load EE list from src/data/ee.json"""
        try:
            # Clear existing items
            self.char_combo.clear()

            # Load EE JSON file
            EE_DATA_FILE = EE_FILE

            if not EE_DATA_FILE.exists():
                error_msg = f"EE data file not found: {EE_DATA_FILE}"
                logger.error(error_msg)
                QMessageBox.critical(self, "Error", error_msg)
                return

            with open(EE_DATA_FILE, 'r', encoding='utf-8') as f:
                ee_data = json.load(f)

            logger.info(f"Loaded EE data file with {len(ee_data)} entries")

            ee_list = []

            # Keys in ee.json are character slugs (same as character file names)
            for slug, ee_info in ee_data.items():
                # Find corresponding character file to get hero ID
                char_file = CHAR_DATA_FOLDER / f"{slug}.json"

                if char_file.exists():
                    try:
                        with open(char_file, 'r', encoding='utf-8') as cf:
                            char_data = json.load(cf)
                            hero_id = char_data.get("ID", "")
                            name = ee_info.get("name", slug)

                            if hero_id:
                                ee_list.append({
                                    "id": hero_id,
                                    "slug": slug,
                                    "name": name
                                })
                            else:
                                logger.warning(f"No ID found in character file {char_file}")
                    except Exception as e:
                        logger.warning(f"Error reading character file {char_file}: {e}")
                else:
                    logger.warning(f"Character file not found for EE slug: {slug}")

            # Sort by ID (same as characters)
            ee_list.sort(key=lambda x: x["id"])

            # Add to combo and build list for completer
            ee_names = []
            for ee in ee_list:
                display_text = f"{ee['name']} (ID: {ee['id']})"
                self.char_combo.addItem(display_text, ee['id'])
                ee_names.append(display_text)

            # Update completer with the list
            completer = self.char_combo.completer()
            if completer:
                from PyQt6.QtCore import QStringListModel
                model = QStringListModel(ee_names)
                completer.setModel(model)

            logger.info(f"Loaded {len(ee_list)} EE into combo box")

        except Exception as e:
            logger.exception("Error loading EE list")
            QMessageBox.critical(self, "Error", f"Failed to load EE list:\n{str(e)}")

    def _on_language_changed(self):
        """Handle language selection change"""
        self.current_language = self.language_combo.currentText()
        lang_config = self.LANGUAGE_CONFIG[self.current_language]
        self.suffix_label.setText(f"Suffix: {lang_config['suffix']} | Bytes Field: {lang_config['bytes_field']}")

    def _on_type_changed(self):
        """Handle type selection change (Character vs EE vs Buff/Debuff)"""
        self.current_type = self.type_combo.currentText()

        # Update group box title and visibility
        if self.current_type == "Character":
            self.select_group.setTitle("Select Character")
            self.select_group.setVisible(True)
            self.buff_extract_btn.setVisible(False)
            self.buff_review_btn.setVisible(False)
            self.merge_btn.setVisible(True)
            self.do_all_btn.setVisible(True)
            self._load_character_list()
        elif self.current_type == "EE":
            self.select_group.setTitle("Select EE")
            self.select_group.setVisible(True)
            self.buff_extract_btn.setVisible(False)
            self.buff_review_btn.setVisible(False)
            self.merge_btn.setVisible(True)
            self.do_all_btn.setVisible(True)
            self._load_ee_list()
        else:  # Buff/Debuff
            self.select_group.setVisible(False)  # Hide selection for Buff/Debuff
            self.buff_extract_btn.setVisible(True)  # Show buff/debuff extract button
            self.buff_review_btn.setVisible(True)  # Show review button
            self.merge_btn.setVisible(False)  # Hide merge button
            self.do_all_btn.setVisible(False)  # Hide do all button

    def _extract_localization(self):
        """Extract localization data from .bytes files"""
        try:
            # Special handling for Buff/Debuff
            if self.current_type == "Buff/Debuff":
                self._extract_buff_debuff_localization()
                return

            item_id = self.char_combo.currentData()
            if not item_id:
                QMessageBox.warning(self, "Warning", f"Please select a {self.current_type.lower()}")
                return

            self.current_char_id = item_id
            lang_config = self.LANGUAGE_CONFIG[self.current_language]

            # Choose extractor based on type
            if self.current_type == "Character":
                from localization_extractor import LocalizationExtractor
                bytes_field = lang_config["bytes_field"]
                suffix = lang_config["suffix"]
                extractor = LocalizationExtractor(item_id, bytes_field, suffix)
            else:  # EE
                from ee_localization_extractor import EELocalizationExtractor
                extractor = EELocalizationExtractor(item_id, lang_config)

            self.extracted_loc_data = extractor.extract()

            # Display preview
            self._display_preview()

            # Load existing JSON
            self._load_existing_json()

            # Enable merge button
            self.merge_btn.setEnabled(True)

            # Update info
            suffix = lang_config["suffix"]
            if self.current_type == "Character":
                item_name = self.extracted_loc_data.get(f'Fullname{suffix}', f'ID {item_id}')
            else:
                item_name = self.extracted_loc_data.get(f'name{suffix}', f'ID {item_id}')
            self.char_info_label.setText(f"Extracted: {item_name}\nID: {item_id}\nReady to merge")

        except Exception as e:
            logger.exception("Error extracting localization")
            QMessageBox.critical(self, "Error", f"Failed to extract localization:\n{str(e)}")

    def _extract_buff_debuff_localization(self):
        """Extract localization for buffs and debuffs by matching English descriptions"""
        try:
            lang_config = self.LANGUAGE_CONFIG[self.current_language]
            bytes_field = lang_config["bytes_field"]

            # Load buffs.json and debuffs.json
            buffs_path = BUFFS_FILE
            debuffs_path = DEBUFFS_FILE

            if not buffs_path.exists() or not debuffs_path.exists():
                QMessageBox.critical(self, "Error", "buffs.json or debuffs.json not found!")
                return

            with open(buffs_path, 'r', encoding='utf-8') as f:
                buffs_data = json.load(f)

            with open(debuffs_path, 'r', encoding='utf-8') as f:
                debuffs_data = json.load(f)

            # Load TextSkill.bytes, TextSystem.bytes, and BuffToolTipTemplet.bytes
            text_skill_path = BYTES_FOLDER / "TextSkill.bytes"
            text_system_path = BYTES_FOLDER / "TextSystem.bytes"
            buff_tooltip_path = BYTES_FOLDER / "BuffToolTipTemplet.bytes"

            if not text_skill_path.exists() or not text_system_path.exists():
                QMessageBox.critical(self, "Error", "TextSkill.bytes or TextSystem.bytes not found!")
                return

            if not buff_tooltip_path.exists():
                QMessageBox.critical(self, "Error", "BuffToolTipTemplet.bytes not found!")
                return

            # Parse .bytes files
            skill_parser = Bytes_parser(str(text_skill_path))
            system_parser = Bytes_parser(str(text_system_path))
            buff_tooltip_parser = Bytes_parser(str(buff_tooltip_path))

            # Combine data from both files
            all_text_data = skill_parser.data + system_parser.data

            # Build lookup dictionary: English text -> row data
            english_lookup = {}
            for row in all_text_data:
                english_text = row.get("English", "").strip()
                if english_text:
                    english_lookup[english_text] = row

            # Build BuffToolTipTemplet lookup: icon name -> (DescIDSymbol, DescID)
            # Note: icons in JSON use SC_ prefix, but BuffToolTipTemplet uses IG_ prefix
            # DescIDSymbol = label (short name), DescID = description (full text)
            buff_tooltip_lookup = {}
            for row in buff_tooltip_parser.data:
                name_id = row.get("NameIDSymbol", "")
                desc_id_symbol = row.get("DescIDSymbol", "")  # Label
                desc_id = row.get("DescID", "")  # Description
                if name_id and desc_id:
                    buff_tooltip_lookup[name_id] = {
                        "label_id": desc_id_symbol,
                        "desc_id": desc_id
                    }

            # Build TextSystem lookup by IDSymbol for secondary lookup
            system_id_lookup = {}
            for row in system_parser.data:
                id_symbol = row.get("IDSymbol", "")
                if id_symbol:
                    system_id_lookup[id_symbol] = row

            # Manual mapping for special cases where icon doesn't match correctly
            MANUAL_MAPPINGS = {
                "BT_STAT|ST_CRITICAL_RATE_IR": {
                    "label_id": "SYS_BUFF_CRITICAL_RATE_UP",
                    "desc_id": "SYS_DESC_CRITICAL_RATE_UP_IGNORE_INTERRUPTION"
                },
                "IG_Buff_Effect_2000072_Interruption": {
                    "label_id": "SYS_BUFF_NAME_2000072",
                    "desc_id": "SYS_BUFF_DESC_2000072"
                },
                "UNIQUE_VENION_D": {
                    "label_id": "SYS_BUFF_NAME_4086014_B",
                    "desc_id": "SYS_BUFF_DESC_4086014_B"
                },
                "UNIQUE_VENION_E": {
                    "label_id": "SYS_BUFF_NAME_4086014_A",
                    "desc_id": "SYS_BUFF_DESC_4086014_A"
                },
                "UNIQUE_VENION_F": {
                    "label_id": "SYS_BUFF_NAME_4086001",
                    "desc_id": "SYS_BUFF_DESC_40860132"
                },
                "BT_CASTER_COPY_BUFF": {
                    "label_id": "SYS_BUFF_NAME_2100093",
                    "desc_id": "SYS_BUFF_DESC_2100093"
                },
                "BT_RANDOM": {
                    "label_id": "SYS_BUFF_NAME_40760091",
                    "desc_id": "SYS_BUFF_DESC_40760091"
                },
                "BT_FIXED_DAMAGE": {
                    "label_id": "SYS_BUFF_TRUE_DAMAGE",
                    "desc_id": None  # Description translated manually
                },
                "BT_REVERSE_HEAL_BASED_CASTER": {
                    "label_id": "SYS_BUFF_TRUE_DAMAGE",
                    "desc_id": None  # Description translated manually
                },
                "BT_REVERSE_HEAL_BASED_TARGET": {
                    "label_id": "SYS_BUFF_TRUE_DAMAGE",
                    "desc_id": None  # Description translated manually
                },
                "BT_STAT|ST_ATK_IR": {
                    "label_id": "SYS_BUFF_ATTACK_DOWN",
                    "desc_id": "SYS_DESC_ATTACK_DOWN_IGNORE_INTERRUPTION"
                },
                "BT_STATBUFF_CONVERT_TO_STATDEBUFF": {
                    "label_id": "SYS_BUFF_CONVERT",
                    "desc_id": "SYS_DESC_BUFF_CONVERT"
                }
            }

            # Match buffs and debuffs
            results = {
                "buffs": [],
                "debuffs": []
            }

            # Get suffix for checking existing localization
            suffix = lang_config["suffix"]
            label_key = f"label{suffix}"
            desc_key = f"description{suffix}"

            # Process buffs
            for buff in buffs_data:
                # Skip if already localized
                if buff.get(label_key) and buff.get(desc_key):
                    continue

                english_label = buff.get("label", "").strip()
                english_desc = buff.get("description", "").strip()
                icon = buff.get("icon", "")

                # Try to find label translation
                label_translation = None
                if english_label and english_label in english_lookup:
                    label_row = english_lookup[english_label]
                    label_translation = label_row.get(bytes_field, "")

                if english_desc in english_lookup:
                    # Direct match found for description
                    matched_row = english_lookup[english_desc]
                    result_entry = {
                        "name": buff.get("name", ""),
                        "label": english_label,
                        "description": english_desc,
                        "matched": True,
                        "translation": matched_row.get(bytes_field, ""),
                        "found_label_translation": label_translation,
                        "source": "direct"
                    }
                    results["buffs"].append(result_entry)
                else:
                    # Check for manual mapping first
                    buff_name = buff.get("name", "")
                    found_system_desc = None
                    found_english_desc = None
                    found_system_label = None
                    found_english_label = None

                    if buff_name in MANUAL_MAPPINGS:
                        # Use manual mapping
                        manual_map = MANUAL_MAPPINGS[buff_name]
                        label_id = manual_map["label_id"]
                        desc_id = manual_map["desc_id"]

                        # Get label from TextSystem if specified
                        if label_id and label_id in system_id_lookup:
                            label_row = system_id_lookup[label_id]
                            found_english_label = label_row.get("English", "").strip()
                            found_system_label = label_row.get(bytes_field, "").strip()

                        # Get description from TextSystem if specified
                        if desc_id and desc_id in system_id_lookup:
                            system_row = system_id_lookup[desc_id]
                            found_english_desc = system_row.get("English", "").strip()
                            found_system_desc = system_row.get(bytes_field, "").strip()

                    else:
                        # Try fallback via BuffToolTipTemplet
                        # Convert SC_ prefix to IG_ prefix for BuffToolTipTemplet lookup
                        ig_icon = icon.replace("SC_", "IG_") if icon.startswith("SC_") else icon

                        if ig_icon in buff_tooltip_lookup:
                            tooltip_data = buff_tooltip_lookup[ig_icon]
                            label_id = tooltip_data["label_id"]
                            desc_id = tooltip_data["desc_id"]

                            # Get label from TextSystem
                            if label_id in system_id_lookup:
                                label_row = system_id_lookup[label_id]
                                found_english_label = label_row.get("English", "").strip()
                                found_system_label = label_row.get(bytes_field, "").strip()

                            # Get description from TextSystem
                            if desc_id in system_id_lookup:
                                system_row = system_id_lookup[desc_id]
                                found_english_desc = system_row.get("English", "").strip()
                                found_system_desc = system_row.get(bytes_field, "").strip()

                    # Only add if we found translations AND texts are similar enough
                    if found_system_label or found_system_desc:
                        # Manual mappings are pre-verified, skip similarity check
                        if buff_name in MANUAL_MAPPINGS:
                            should_add = True
                        else:
                            # Check similarity for description (most important)
                            desc_similarity = 0.0
                            if found_english_desc and english_desc:
                                desc_similarity = calculate_text_similarity(english_desc, found_english_desc)

                            # Check similarity for label
                            label_similarity = 0.0
                            if found_english_label and english_label:
                                label_similarity = calculate_text_similarity(english_label, found_english_label)

                            # Only accept if similarity is very high (at least 90%)
                            # This filters out completely wrong matches from icon mapping
                            should_add = desc_similarity >= 0.9 or label_similarity >= 0.9

                        if should_add:
                            result_entry = {
                                "name": buff.get("name", ""),
                                "label": buff.get("label", ""),
                                "description": english_desc,
                                "matched": False,
                                "translation": "",
                                "source": "manual" if buff_name in MANUAL_MAPPINGS else "tooltip",
                                "found_label": found_english_label if found_english_label else None,
                                "found_label_translation": found_system_label if found_system_label else None,
                                "found_description": found_english_desc if found_english_desc else None,
                                "found_description_translation": found_system_desc if found_system_desc else None
                            }
                            results["buffs"].append(result_entry)
                    else:
                        # No match found at all - add as missing
                        result_entry = {
                            "name": buff.get("name", ""),
                            "label": buff.get("label", ""),
                            "description": english_desc,
                            "matched": False,
                            "translation": "",
                            "source": "missing",
                            "found_label": None,
                            "found_label_translation": None,
                            "found_description": None,
                            "found_description_translation": None
                        }
                        results["buffs"].append(result_entry)

            # Process debuffs
            for debuff in debuffs_data:
                # Skip if already localized
                if debuff.get(label_key) and debuff.get(desc_key):
                    continue

                english_label = debuff.get("label", "").strip()
                english_desc = debuff.get("description", "").strip()
                icon = debuff.get("icon", "")

                # Try to find label translation
                label_translation = None
                if english_label and english_label in english_lookup:
                    label_row = english_lookup[english_label]
                    label_translation = label_row.get(bytes_field, "")

                if english_desc in english_lookup:
                    # Direct match found for description
                    matched_row = english_lookup[english_desc]
                    result_entry = {
                        "name": debuff.get("name", ""),
                        "label": english_label,
                        "description": english_desc,
                        "matched": True,
                        "translation": matched_row.get(bytes_field, ""),
                        "found_label_translation": label_translation,
                        "source": "direct"
                    }
                    results["debuffs"].append(result_entry)
                else:
                    # Check for manual mapping first
                    debuff_name = debuff.get("name", "")
                    found_system_desc = None
                    found_english_desc = None
                    found_system_label = None
                    found_english_label = None

                    if debuff_name in MANUAL_MAPPINGS:
                        # Use manual mapping
                        manual_map = MANUAL_MAPPINGS[debuff_name]
                        label_id = manual_map["label_id"]
                        desc_id = manual_map["desc_id"]

                        # Get label from TextSystem if specified
                        if label_id and label_id in system_id_lookup:
                            label_row = system_id_lookup[label_id]
                            found_english_label = label_row.get("English", "").strip()
                            found_system_label = label_row.get(bytes_field, "").strip()

                        # Get description from TextSystem if specified
                        if desc_id and desc_id in system_id_lookup:
                            system_row = system_id_lookup[desc_id]
                            found_english_desc = system_row.get("English", "").strip()
                            found_system_desc = system_row.get(bytes_field, "").strip()

                    else:
                        # Try fallback via BuffToolTipTemplet
                        # Convert SC_ prefix to IG_ prefix for BuffToolTipTemplet lookup
                        ig_icon = icon.replace("SC_", "IG_") if icon.startswith("SC_") else icon

                        if ig_icon in buff_tooltip_lookup:
                            tooltip_data = buff_tooltip_lookup[ig_icon]
                            label_id = tooltip_data["label_id"]
                            desc_id = tooltip_data["desc_id"]

                            # Get label from TextSystem
                            if label_id in system_id_lookup:
                                label_row = system_id_lookup[label_id]
                                found_english_label = label_row.get("English", "").strip()
                                found_system_label = label_row.get(bytes_field, "").strip()

                            # Get description from TextSystem
                            if desc_id in system_id_lookup:
                                system_row = system_id_lookup[desc_id]
                                found_english_desc = system_row.get("English", "").strip()
                                found_system_desc = system_row.get(bytes_field, "").strip()

                    # Only add if we found translations AND texts are similar enough
                    if found_system_label or found_system_desc:
                        # Manual mappings are pre-verified, skip similarity check
                        if debuff_name in MANUAL_MAPPINGS:
                            should_add = True
                        else:
                            # Check similarity for description (most important)
                            desc_similarity = 0.0
                            if found_english_desc and english_desc:
                                desc_similarity = calculate_text_similarity(english_desc, found_english_desc)

                            # Check similarity for label
                            label_similarity = 0.0
                            if found_english_label and english_label:
                                label_similarity = calculate_text_similarity(english_label, found_english_label)

                            # Only accept if similarity is very high (at least 90%)
                            # This filters out completely wrong matches from icon mapping
                            should_add = desc_similarity >= 0.9 or label_similarity >= 0.9

                        if should_add:
                            result_entry = {
                                "name": debuff.get("name", ""),
                                "label": debuff.get("label", ""),
                                "description": english_desc,
                                "matched": False,
                                "translation": "",
                                "source": "manual" if debuff_name in MANUAL_MAPPINGS else "tooltip",
                                "found_label": found_english_label if found_english_label else None,
                                "found_label_translation": found_system_label if found_system_label else None,
                                "found_description": found_english_desc if found_english_desc else None,
                                "found_description_translation": found_system_desc if found_system_desc else None
                            }
                            results["debuffs"].append(result_entry)
                    else:
                        # No match found at all - add as missing
                        result_entry = {
                            "name": debuff.get("name", ""),
                            "label": debuff.get("label", ""),
                            "description": english_desc,
                            "matched": False,
                            "translation": "",
                            "source": "missing",
                            "found_label": None,
                            "found_label_translation": None,
                            "found_description": None,
                            "found_description_translation": None
                        }
                        results["debuffs"].append(result_entry)

            # Store results
            self.extracted_loc_data = results

            # Display preview
            self._display_buff_debuff_preview()

            # Enable review button
            self.buff_review_btn.setEnabled(True)

            # Update info
            total_buffs = len(results["buffs"])
            matched_buffs = sum(1 for b in results["buffs"] if b["matched"])
            total_debuffs = len(results["debuffs"])
            matched_debuffs = sum(1 for d in results["debuffs"] if d["matched"])

            self.char_info_label.setText(
                f"Buffs: {matched_buffs}/{total_buffs} found\n"
                f"Debuffs: {matched_debuffs}/{total_debuffs} found\n"
                f"(Non-localized only)"
            )

            logger.info(f"Buff/Debuff extraction complete: {matched_buffs}/{total_buffs} buffs, {matched_debuffs}/{total_debuffs} debuffs matched")

        except Exception as e:
            logger.exception("Error extracting buff/debuff localization")
            QMessageBox.critical(self, "Error", f"Failed to extract buff/debuff localization:\n{str(e)}")

    def _display_buff_debuff_preview(self):
        """Display buff/debuff extraction results - show missing items in simple format"""
        if not self.extracted_loc_data:
            self.preview_text.setPlainText("No data extracted")
            return

        # Build text output
        lines = []

        # Count items with translations found
        buffs_with_translations = 0
        debuffs_with_translations = 0

        # Separate missing items
        missing_buffs = []
        missing_debuffs = []

        # Process buffs
        for buff in self.extracted_loc_data["buffs"]:
            has_label_translation = False
            has_desc_translation = False

            if buff["matched"]:
                has_label_translation = bool(buff.get("found_label_translation"))
                has_desc_translation = bool(buff.get("translation"))
            else:
                has_label_translation = bool(buff.get("found_label_translation"))
                has_desc_translation = bool(buff.get("found_description_translation"))

            if has_label_translation and has_desc_translation:
                buffs_with_translations += 1
            else:
                missing_buffs.append({
                    "name": buff["name"],
                    "has_label": has_label_translation,
                    "has_desc": has_desc_translation
                })

        # Process debuffs
        for debuff in self.extracted_loc_data["debuffs"]:
            has_label_translation = False
            has_desc_translation = False

            if debuff["matched"]:
                has_label_translation = bool(debuff.get("found_label_translation"))
                has_desc_translation = bool(debuff.get("translation"))
            else:
                has_label_translation = bool(debuff.get("found_label_translation"))
                has_desc_translation = bool(debuff.get("found_description_translation"))

            if has_label_translation and has_desc_translation:
                debuffs_with_translations += 1
            else:
                missing_debuffs.append({
                    "name": debuff["name"],
                    "has_label": has_label_translation,
                    "has_desc": has_desc_translation
                })

        # Summary
        total_buffs = len(self.extracted_loc_data["buffs"])
        total_debuffs = len(self.extracted_loc_data["debuffs"])

        lines.append("=" * 80)
        lines.append("BUFF/DEBUFF EXTRACTION SUMMARY")
        lines.append("=" * 80)
        lines.append(f"Buffs: {buffs_with_translations}/{total_buffs} with complete translations")
        lines.append(f"Debuffs: {debuffs_with_translations}/{total_debuffs} with complete translations")
        lines.append("")

        # Missing buffs
        if missing_buffs:
            lines.append("=" * 80)
            lines.append("MISSING BUFFS")
            lines.append("=" * 80)
            lines.append("")
            for buff in missing_buffs:
                lines.append(buff["name"])
                missing_parts = []
                if not buff["has_label"]:
                    missing_parts.append("missing label")
                if not buff["has_desc"]:
                    missing_parts.append("missing desc")
                lines.append("  " + " & ".join(missing_parts))
                lines.append("")

        # Missing debuffs
        if missing_debuffs:
            lines.append("=" * 80)
            lines.append("MISSING DEBUFFS")
            lines.append("=" * 80)
            lines.append("")
            for debuff in missing_debuffs:
                lines.append(debuff["name"])
                missing_parts = []
                if not debuff["has_label"]:
                    missing_parts.append("missing label")
                if not debuff["has_desc"]:
                    missing_parts.append("missing desc")
                lines.append("  " + " & ".join(missing_parts))
                lines.append("")

        if not missing_buffs and not missing_debuffs:
            lines.append("")
            lines.append("All items have complete translations!")

        self.preview_text.setPlainText("\n".join(lines))

    def _open_buff_review_dialog(self):
        """Open dialog to review and apply buff/debuff translations"""
        if not self.extracted_loc_data:
            QMessageBox.warning(self, "Warning", "No data extracted yet")
            return

        lang_config = self.LANGUAGE_CONFIG[self.current_language]
        suffix = lang_config["suffix"]

        # Open review dialog (translations are applied immediately on each Apply click)
        dialog = BuffReviewDialog(
            self.extracted_loc_data["buffs"],
            self.extracted_loc_data["debuffs"],
            suffix,
            self
        )

        if dialog.exec() == QDialog.DialogCode.Accepted:
            applied_items = dialog.get_applied_items()
            if applied_items:
                QMessageBox.information(
                    self,
                    "Success",
                    f"Applied {len(applied_items)} translation(s) to buffs.json and debuffs.json"
                )
                logger.info(f"Completed buff/debuff translation review: {len(applied_items)} items applied")
            else:
                QMessageBox.information(self, "Info", "No items applied")

    def _apply_buff_debuff_translations(self, selected_items, suffix):
        """Apply selected translations to buffs.json and debuffs.json"""
        try:
            # Load current JSON files
            buffs_path = BUFFS_FILE
            debuffs_path = DEBUFFS_FILE

            with open(buffs_path, 'r', encoding='utf-8') as f:
                buffs_data = json.load(f)

            with open(debuffs_path, 'r', encoding='utf-8') as f:
                debuffs_data = json.load(f)

            # Apply translations
            applied_count = 0
            label_key = f"label{suffix}"
            desc_key = f"description{suffix}"

            for item in selected_items:
                item_type = item["type"]
                item_name = item["name"]

                # Find the item in extracted data
                extracted_item = None
                if item_type == "Buff":
                    for buff in self.extracted_loc_data["buffs"]:
                        if buff["name"] == item_name:
                            extracted_item = buff
                            break
                else:  # Debuff
                    for debuff in self.extracted_loc_data["debuffs"]:
                        if debuff["name"] == item_name:
                            extracted_item = debuff
                            break

                if not extracted_item:
                    continue

                # Find the item in JSON data
                json_data = buffs_data if item_type == "Buff" else debuffs_data
                for json_item in json_data:
                    if json_item["name"] == item_name:
                        # Apply label translation
                        if extracted_item.get("found_label_translation"):
                            json_item[label_key] = extracted_item["found_label_translation"]

                        # Apply description translation
                        if extracted_item.get("matched"):
                            json_item[desc_key] = extracted_item["translation"]
                        elif extracted_item.get("found_description_translation"):
                            json_item[desc_key] = extracted_item["found_description_translation"]

                        applied_count += 1
                        break

            # Save updated JSON files
            with open(buffs_path, 'w', encoding='utf-8') as f:
                json.dump(buffs_data, f, indent=2, ensure_ascii=False)

            with open(debuffs_path, 'w', encoding='utf-8') as f:
                json.dump(debuffs_data, f, indent=2, ensure_ascii=False)

            QMessageBox.information(
                self,
                "Success",
                f"Applied {applied_count} translations to buffs.json and debuffs.json"
            )
            logger.info(f"Applied {applied_count} buff/debuff translations")

        except Exception as e:
            logger.exception("Error applying translations")
            QMessageBox.critical(self, "Error", f"Failed to apply translations:\n{str(e)}")

    def _display_preview(self):
        """Display extracted localization data in preview area"""
        if not self.extracted_loc_data:
            self.preview_text.setPlainText("No data extracted")
            return

        preview_lines = []
        preview_lines.append("=" * 60)
        preview_lines.append("EXTRACTED LOCALIZATION DATA")
        preview_lines.append("=" * 60)
        preview_lines.append("")

        lang_config = self.LANGUAGE_CONFIG[self.current_language]
        suffix = lang_config["suffix"]

        if self.current_type == "Character":
            # Fullname
            fullname_key = f"Fullname{suffix}"
            if fullname_key in self.extracted_loc_data:
                preview_lines.append(f"[{fullname_key}]")
                preview_lines.append(self.extracted_loc_data[fullname_key])
                preview_lines.append("")

            # Voice Actor
            va_key = f"VoiceActor{suffix}"
            if va_key in self.extracted_loc_data:
                preview_lines.append(f"[{va_key}]")
                preview_lines.append(self.extracted_loc_data[va_key])
                preview_lines.append("")

            # Transcend
            if "transcend" in self.extracted_loc_data:
                preview_lines.append("[Transcend Texts]")
                for key, value in sorted(self.extracted_loc_data["transcend"].items()):
                    preview_lines.append(f"  {key}: {value}")
                preview_lines.append("")

            # Skills
            if "skills" in self.extracted_loc_data:
                preview_lines.append("[Skills]")
                for skill_type, skill_info in self.extracted_loc_data["skills"].items():
                    preview_lines.append(f"\n  {skill_type}:")
                    for key, value in skill_info.items():
                        if key == "enhancement":
                            preview_lines.append(f"    enhancement:")
                            for enh_key, enh_value in value.items():
                                preview_lines.append(f"      {enh_key}: {enh_value}")
                        else:
                            preview_lines.append(f"    {key}: {value}")

        else:  # EE
            # Name
            name_key = f"name{suffix}"
            if name_key in self.extracted_loc_data:
                preview_lines.append(f"[{name_key}]")
                preview_lines.append(self.extracted_loc_data[name_key])
                preview_lines.append("")

            # MainStat
            mainstat_key = f"mainStat{suffix}"
            if mainstat_key in self.extracted_loc_data:
                preview_lines.append(f"[{mainstat_key}]")
                preview_lines.append(self.extracted_loc_data[mainstat_key])
                preview_lines.append("")

            # Effect
            effect_key = f"effect{suffix}"
            if effect_key in self.extracted_loc_data:
                preview_lines.append(f"[{effect_key}]")
                preview_lines.append(self.extracted_loc_data[effect_key])
                preview_lines.append("")

            # Effect10
            effect10_key = f"effect10{suffix}"
            if effect10_key in self.extracted_loc_data:
                preview_lines.append(f"[{effect10_key}]")
                preview_lines.append(self.extracted_loc_data[effect10_key])
                preview_lines.append("")

        preview_text = "\n".join(preview_lines)
        self.preview_text.setPlainText(preview_text)

    def _load_existing_json(self):
        """Load existing JSON file (character or EE)"""
        try:
            if self.current_type == "Character":
                # Find JSON file for this character
                for file_path in CHAR_DATA_FOLDER.glob("*.json"):
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        if data.get("ID") == self.current_char_id:
                            self.current_char_json = data
                            logger.info(f"Loaded existing JSON for character {self.current_char_id}: {file_path.name}")
                            return

                QMessageBox.warning(self, "Warning", f"Could not find existing JSON file for character ID {self.current_char_id}")

            else:  # EE
                # Load ee.json file
                EE_DATA_FILE = EE_FILE

                if not EE_DATA_FILE.exists():
                    QMessageBox.warning(self, "Warning", f"EE data file not found: {EE_DATA_FILE}")
                    return

                with open(EE_DATA_FILE, 'r', encoding='utf-8') as f:
                    ee_data = json.load(f)

                # Find slug by hero ID (need to check character files)
                slug_found = None
                for slug in ee_data.keys():
                    char_file = CHAR_DATA_FOLDER / f"{slug}.json"
                    if char_file.exists():
                        try:
                            with open(char_file, 'r', encoding='utf-8') as cf:
                                char_data = json.load(cf)
                                if char_data.get("ID") == self.current_char_id:
                                    slug_found = slug
                                    break
                        except Exception as e:
                            logger.warning(f"Error reading {char_file}: {e}")

                if slug_found:
                    self.current_char_json = ee_data[slug_found]
                    self.current_char_slug = slug_found  # Store slug for merge
                    logger.info(f"Loaded existing EE entry for {self.current_char_id} (slug: {slug_found})")
                else:
                    QMessageBox.warning(self, "Warning", f"EE for hero ID {self.current_char_id} not found in ee.json")

        except Exception as e:
            logger.exception("Error loading existing JSON")
            QMessageBox.warning(self, "Warning", f"Failed to load existing JSON:\n{str(e)}")

    def _sort_lang_dict(self, data: dict) -> dict:
        """
        Sort dictionary keys with language variants in proper order.
        For each base key (e.g., "2", "4_1"), orders variants as: base, _jp, _kr, _zh
        COPIED from CharacterTab._sort_lang_dict
        """
        result = {}

        # Get all unique base keys (without language suffixes)
        all_keys = set()
        for key in data.keys():
            # Extract base key: "4_1_kr" -> "4_1", "3_jp" -> "3", "5" -> "5"
            if key.endswith('_jp') or key.endswith('_kr') or key.endswith('_zh'):
                base_key = key.rsplit('_', 1)[0]  # Remove last suffix
            else:
                base_key = key
            all_keys.add(base_key)

        # Sort base keys: handle "4_1", "4_2", "5_1" etc
        def sort_key(x):
            parts = x.split('_')
            if len(parts) == 1 and parts[0].isdigit():
                return (int(parts[0]), 0)  # "3" -> (3, 0)
            elif len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                return (int(parts[0]), int(parts[1]))  # "4_1" -> (4, 1)
            else:
                return (999, 0)  # Non-numeric keys last

        sorted_base_keys = sorted(all_keys, key=sort_key)

        # For each base key, add variants in order: base (en), _jp, _kr, _zh
        lang_order = ['', '_jp', '_kr', '_zh']
        for base_key in sorted_base_keys:
            for lang_suffix in lang_order:
                full_key = f"{base_key}{lang_suffix}" if lang_suffix else base_key
                if full_key in data:
                    result[full_key] = data[full_key]

        return result

    def _reorder_char_json(self, data: dict) -> dict:
        """
        Reorder character JSON fields for better readability
        COPIED from CharacterTab._reorder_json
        """
        ordered = {}

        # Top-level fields in desired order
        field_order = [
            'ID',
            'Fullname', 'Fullname_jp', 'Fullname_kr', 'Fullname_zh',
            'Rarity',
            'Element',
            'Class',
            'SubClass',
            'rank',
            'rank_pvp',
            'role',
            'tags',
            'skill_priority',
            'Chain_Type',
            'gift',
            'video',
            'VoiceActor', 'VoiceActor_jp', 'VoiceActor_kr', 'VoiceActor_zh',
        ]

        # Add top-level fields in order
        for field in field_order:
            if field in data:
                ordered[field] = data[field]

        # Add transcend object (new format) with sorted keys
        if 'transcend' in data:
            ordered['transcend'] = self._sort_lang_dict(data['transcend'])

        # Add transcend fields (old format)
        transcend_keys = sorted([k for k in data.keys() if k.startswith('Transcend_')])
        for key in transcend_keys:
            ordered[key] = data[key]

        # Add skills in order
        if 'skills' in data:
            skills_ordered = {}
            skill_order = ['SKT_FIRST', 'SKT_SECOND', 'SKT_ULTIMATE', 'SKT_PASSIVE', 'SKT_CHAIN_PASSIVE']
            for skill_key in skill_order:
                if skill_key in data['skills']:
                    skill_data = data['skills'][skill_key]
                    ordered_skill = {}

                    # Skill field order
                    skill_field_order = [
                        'NameIDSymbol', 'IconName', 'SkillType',
                        'name', 'name_jp', 'name_kr', 'name_zh',
                        'true_desc', 'true_desc_jp', 'true_desc_kr', 'true_desc_zh',
                        'enhancement',
                        'wgr', 'wgr_dual', 'cd',
                        'buff', 'debuff', 'burnEffect',
                    ]

                    for field in skill_field_order:
                        if field in skill_data:
                            # Sort enhancement dict if it exists
                            if field == 'enhancement' and isinstance(skill_data[field], dict):
                                ordered_skill[field] = self._sort_lang_dict(skill_data[field])
                            else:
                                ordered_skill[field] = skill_data[field]

                    # Add remaining fields
                    for field in skill_data:
                        if field not in ordered_skill:
                            ordered_skill[field] = skill_data[field]

                    skills_ordered[skill_key] = ordered_skill

            ordered['skills'] = skills_ordered

        # Add any remaining fields not in the order list
        for key in data:
            if key not in ordered:
                ordered[key] = data[key]

        return ordered

    def _merge_dict_ordered(self, existing_dict, new_dict, suffix):
        """
        Merge new_dict into existing_dict, preserving key order.
        Uses the same sorting logic as CharacterTab._sort_lang_dict.

        Expected order for each base key: base, _jp, _kr, _zh

        Args:
            existing_dict: The existing dictionary (e.g., transcend or enhancement)
            new_dict: The new dictionary with localized keys to merge
            suffix: The language suffix (e.g., "_zh") - not used but kept for compatibility

        Returns:
            A new dict with proper key ordering
        """
        # Merge the dicts first
        merged = {}
        merged.update(existing_dict)
        merged.update(new_dict)

        # Sort using same logic as CharacterTab
        result = {}
        all_keys = set()
        for key in merged.keys():
            # Extract base key: "4_1_kr" -> "4_1", "3_jp" -> "3", "5" -> "5"
            # Remove language suffixes (_jp, _kr, _zh) to get base key
            if key.endswith('_jp') or key.endswith('_kr') or key.endswith('_zh'):
                base_key = key.rsplit('_', 1)[0]  # Remove last suffix
            else:
                base_key = key
            all_keys.add(base_key)

        # Sort base keys: need to handle "4_1", "4_2", "5_1" etc
        def sort_key(x):
            parts = x.split('_')
            if len(parts) == 1 and parts[0].isdigit():
                return (int(parts[0]), 0)  # "3" -> (3, 0)
            elif len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                return (int(parts[0]), int(parts[1]))  # "4_1" -> (4, 1)
            else:
                return (999, 0)  # Non-numeric keys last

        sorted_base_keys = sorted(all_keys, key=sort_key)

        lang_order = ['', '_jp', '_kr', '_zh']
        for base_key in sorted_base_keys:
            for lang_suffix in lang_order:
                full_key = f"{base_key}{lang_suffix}" if lang_suffix else base_key
                if full_key in merged:
                    result[full_key] = merged[full_key]

        return result

    def _reorder_ee_json(self, data: dict) -> dict:
        """
        Reorder EE JSON fields for better readability.
        Maintains language order: en → jp → kr → zh for each field.

        Field order:
        - name, name_jp, name_kr, name_zh
        - mainStat, mainStat_jp, mainStat_kr, mainStat_zh
        - effect, effect_jp, effect_kr, effect_zh
        - effect10, effect10_jp, effect10_kr, effect10_zh
        - icon_effect, rank, buff, debuff
        """
        ordered = {}

        # Define language suffix order
        lang_order = ['', '_jp', '_kr', '_zh']

        # Field groups in order
        field_groups = [
            'name',
            'mainStat',
            'effect',
            'effect10',
        ]

        # Add each field group with language variants in order
        for base_field in field_groups:
            for lang_suffix in lang_order:
                field_key = f"{base_field}{lang_suffix}" if lang_suffix else base_field
                if field_key in data:
                    ordered[field_key] = data[field_key]

        # Add remaining fields in order
        remaining_fields = ['icon_effect', 'rank', 'buff', 'debuff']
        for field in remaining_fields:
            if field in data:
                ordered[field] = data[field]

        # Add any other fields not explicitly ordered
        for key in data:
            if key not in ordered:
                ordered[key] = data[key]

        return ordered

    def _merge_ee_to_json(self, suffix):
        """Merge EE localization to ee.json"""
        if not hasattr(self, 'current_char_slug') or not self.current_char_slug:
            QMessageBox.critical(self, "Error", "Character slug not found. Cannot merge EE data.")
            return

        # Merge name
        name_key = f"name{suffix}"
        if name_key in self.extracted_loc_data:
            self.current_char_json[name_key] = self.extracted_loc_data[name_key]

        # Merge mainStat
        mainstat_key = f"mainStat{suffix}"
        if mainstat_key in self.extracted_loc_data:
            self.current_char_json[mainstat_key] = self.extracted_loc_data[mainstat_key]

        # Merge effect
        effect_key = f"effect{suffix}"
        if effect_key in self.extracted_loc_data:
            self.current_char_json[effect_key] = self.extracted_loc_data[effect_key]

        # Merge effect10
        effect10_key = f"effect10{suffix}"
        if effect10_key in self.extracted_loc_data:
            self.current_char_json[effect10_key] = self.extracted_loc_data[effect10_key]

        # Reorder EE keys to maintain proper language order
        self.current_char_json = self._reorder_ee_json(self.current_char_json)

        # Load full ee.json file
        EE_DATA_FILE = EE_FILE

        with open(EE_DATA_FILE, 'r', encoding='utf-8') as f:
            ee_data = json.load(f)

        # Update the EE entry using the slug
        ee_data[self.current_char_slug] = self.current_char_json

        # Save back to ee.json
        with open(EE_DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(ee_data, f, ensure_ascii=False, indent=2)

        QMessageBox.information(
            self,
            "Success",
            f"Successfully merged EE localization to ee.json\nSlug: {self.current_char_slug}\nID: {self.current_char_id}"
        )
        logger.info(f"Merged EE localization for {self.current_char_id} (slug: {self.current_char_slug}) to ee.json")

        # Update info
        ee_name = self.extracted_loc_data.get(f'name{suffix}', f'ID {self.current_char_id}')
        self.char_info_label.setText(f"Merged and saved!\nSlug: {self.current_char_slug}\nID: {self.current_char_id}\nName: {ee_name}")

    def _merge_to_json(self):
        """Merge extracted localization data into existing JSON (character or EE)"""
        try:
            if not self.extracted_loc_data:
                QMessageBox.warning(self, "Warning", "No extracted data to merge")
                return

            if not self.current_char_json:
                QMessageBox.warning(self, "Warning", "No existing JSON loaded")
                return

            lang_config = self.LANGUAGE_CONFIG[self.current_language]
            suffix = lang_config["suffix"]

            if self.current_type == "EE":
                self._merge_ee_to_json(suffix)
                return

            # Character merge logic follows...

            # Merge Fullname
            fullname_key = f"Fullname{suffix}"
            if fullname_key in self.extracted_loc_data:
                self.current_char_json[fullname_key] = self.extracted_loc_data[fullname_key]

            # Merge Voice Actor
            va_key = f"VoiceActor{suffix}"
            if va_key in self.extracted_loc_data:
                self.current_char_json[va_key] = self.extracted_loc_data[va_key]

            # Merge Transcend texts
            if "transcend" in self.extracted_loc_data:
                if "transcend" not in self.current_char_json:
                    self.current_char_json["transcend"] = {}

                # Rebuild transcend dict with proper key order
                self.current_char_json["transcend"] = self._merge_dict_ordered(
                    self.current_char_json["transcend"],
                    self.extracted_loc_data["transcend"],
                    suffix
                )

            # Merge Skills
            if "skills" in self.extracted_loc_data:
                if "skills" not in self.current_char_json:
                    self.current_char_json["skills"] = {}

                for skill_type, skill_info in self.extracted_loc_data["skills"].items():
                    if skill_type not in self.current_char_json["skills"]:
                        self.current_char_json["skills"][skill_type] = {}

                    skill_data = self.current_char_json["skills"][skill_type]

                    # Merge skill name
                    name_key = f"name{suffix}"
                    if name_key in skill_info:
                        skill_data[name_key] = skill_info[name_key]

                    # Merge true_desc
                    desc_key = f"true_desc{suffix}"
                    if desc_key in skill_info:
                        skill_data[desc_key] = skill_info[desc_key]

                    # Merge enhancements
                    if "enhancement" in skill_info:
                        if "enhancement" not in skill_data:
                            skill_data["enhancement"] = {}

                        # Rebuild enhancement dict with proper key order
                        skill_data["enhancement"] = self._merge_dict_ordered(
                            skill_data["enhancement"],
                            skill_info["enhancement"],
                            suffix
                        )

                    # Merge burn effects
                    if "burnEffect" in skill_info:
                        if "burnEffect" not in skill_data:
                            skill_data["burnEffect"] = {}

                        for burst_type, burst_data in skill_info["burnEffect"].items():
                            if burst_type not in skill_data["burnEffect"]:
                                skill_data["burnEffect"][burst_type] = {}

                            # Merge new keys
                            for key, value in burst_data.items():
                                skill_data["burnEffect"][burst_type][key] = value

                            # Reorder keys: effect, effect_jp, effect_kr, effect_zh, cost, level
                            burst_ordered = {}
                            field_order = ['effect', 'effect_jp', 'effect_kr', 'effect_zh', 'cost', 'level']
                            for field in field_order:
                                if field in skill_data["burnEffect"][burst_type]:
                                    burst_ordered[field] = skill_data["burnEffect"][burst_type][field]
                            # Add any remaining fields
                            for field in skill_data["burnEffect"][burst_type]:
                                if field not in burst_ordered:
                                    burst_ordered[field] = skill_data["burnEffect"][burst_type][field]
                            skill_data["burnEffect"][burst_type] = burst_ordered

            # Find the JSON file and save
            char_file = None
            for file_path in CHAR_DATA_FOLDER.glob("*.json"):
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if data.get("ID") == self.current_char_id:
                        char_file = file_path
                        break

            if not char_file:
                QMessageBox.critical(self, "Error", f"Could not find JSON file for character ID {self.current_char_id}")
                return

            # Reorder JSON before saving (same as CharacterTab)
            ordered_json = self._reorder_char_json(self.current_char_json)

            # Save merged data
            with open(char_file, 'w', encoding='utf-8') as f:
                json.dump(ordered_json, f, ensure_ascii=False, indent=2)

            # Update character-profiles.json with localization data
            try:
                profile_mgr = ProfileManager()
                fullname_en = self.current_char_json.get("Fullname", "")
                fullname_jp = self.current_char_json.get("Fullname_jp", "")
                fullname_kr = self.current_char_json.get("Fullname_kr", "")
                fullname_zh = self.current_char_json.get("Fullname_zh", "")

                if fullname_en:
                    # Extract or update profile
                    profile = profile_mgr.extract_profile(
                        self.current_char_id,
                        fullname_en,
                        fullname_jp or fullname_en,
                        fullname_kr or fullname_en,
                        fullname_zh or fullname_en
                    )

                    if profile:

                        # Update profile in character-profiles.json
                        profile_mgr.update_profile(fullname_en, profile)
                        logger.info(f"Updated character-profiles.json for {fullname_en}")
                    else:
                        logger.warning(f"Could not extract profile for character {self.current_char_id}")
                else:
                    logger.warning(f"No English fullname found for character {self.current_char_id}, skipping profile update")
            except Exception as profile_err:
                logger.error(f"Error updating character-profiles.json: {profile_err}")
                # Don't fail the whole operation if profile update fails

            QMessageBox.information(
                self,
                "Success",
                f"Successfully merged localization data to:\n{char_file.name}"
            )
            logger.info(f"Merged localization data for character {self.current_char_id} to {char_file}")

            # Update info
            self.char_info_label.setText(f"Merged and saved!\nID: {self.current_char_id}\nFile: {char_file.name}")

        except Exception as e:
            logger.exception("Error merging to JSON")
            QMessageBox.critical(self, "Error", f"Failed to merge to JSON:\n{str(e)}")

    def _do_all_auto_merge(self):
        """Extract and merge localization for all characters or EE entries"""
        try:
            if self.current_type == "Character":
                self._do_all_characters()
            else:  # EE
                self._do_all_ee()
        except Exception as e:
            logger.exception("Error in Do All + Auto Merge")
            QMessageBox.critical(self, "Error", f"Failed to process all items:\n{str(e)}")

    def _do_all_characters(self):
        """Extract and merge localization for all characters"""
        try:
            # Get language configuration
            lang_config = self.LANGUAGE_CONFIG[self.current_language]
            suffix = lang_config["suffix"]
            bytes_field = lang_config["bytes_field"]

            # Get all character files
            char_files = list(CHAR_DATA_FOLDER.glob("*.json"))
            total = len(char_files)

            if total == 0:
                QMessageBox.warning(self, "Warning", "No character files found")
                return

            # Confirm with user
            reply = QMessageBox.question(
                self,
                "Confirm",
                f"Process all {total} characters for {self.current_language} localization?\n\n"
                f"This will extract and merge localization for all characters.",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
            )

            if reply != QMessageBox.StandardButton.Yes:
                return

            # Disable UI during processing
            self.do_all_btn.setEnabled(False)
            self.extract_btn.setEnabled(False)
            self.merge_btn.setEnabled(False)

            success_count = 0
            error_count = 0
            skipped_count = 0

            # Initialize ProfileManager for batch processing
            profile_mgr = ProfileManager()

            # Process each character
            for i, char_file in enumerate(char_files, 1):
                try:
                    # Update status
                    self.char_info_label.setText(
                        f"Processing {i}/{total}: {char_file.stem}..."
                    )
                    QApplication.processEvents()  # Update UI

                    # Load character data
                    with open(char_file, 'r', encoding='utf-8') as f:
                        char_data = json.load(f)

                    char_id = char_data.get("ID", "")
                    if not char_id:
                        logger.warning(f"Skipping {char_file.name}: No ID field")
                        skipped_count += 1
                        continue

                    # Extract localization
                    from localization_extractor import LocalizationExtractor
                    extractor = LocalizationExtractor(char_id, bytes_field, suffix)
                    loc_data = extractor.extract()

                    if not loc_data:
                        logger.warning(f"No localization data extracted for {char_id}")
                        skipped_count += 1
                        continue

                    # Set current data for merging
                    self.current_char_id = char_id
                    self.current_char_json = char_data
                    self.extracted_loc_data = loc_data

                    # Merge (reuse existing logic)
                    # Merge Fullname
                    fullname_key = f"Fullname{suffix}"
                    if fullname_key in loc_data:
                        char_data[fullname_key] = loc_data[fullname_key]

                    # Merge Voice Actor
                    va_key = f"VoiceActor{suffix}"
                    if va_key in loc_data:
                        char_data[va_key] = loc_data[va_key]

                    # Merge Transcend texts
                    if "transcend" in loc_data:
                        if "transcend" not in char_data:
                            char_data["transcend"] = {}
                        char_data["transcend"] = self._merge_dict_ordered(
                            char_data["transcend"],
                            loc_data["transcend"],
                            suffix
                        )

                    # Merge Skills
                    if "skills" in loc_data:
                        if "skills" not in char_data:
                            char_data["skills"] = {}

                        for skill_type, skill_info in loc_data["skills"].items():
                            if skill_type not in char_data["skills"]:
                                char_data["skills"][skill_type] = {}

                            skill_data = char_data["skills"][skill_type]

                            # Merge skill name
                            name_key = f"name{suffix}"
                            if name_key in skill_info:
                                skill_data[name_key] = skill_info[name_key]

                            # Merge true_desc
                            desc_key = f"true_desc{suffix}"
                            if desc_key in skill_info:
                                skill_data[desc_key] = skill_info[desc_key]

                            # Merge enhancement
                            if "enhancement" in skill_info:
                                if "enhancement" not in skill_data:
                                    skill_data["enhancement"] = {}
                                skill_data["enhancement"] = self._merge_dict_ordered(
                                    skill_data["enhancement"],
                                    skill_info["enhancement"],
                                    suffix
                                )

                            # Merge burn effects
                            if "burnEffect" in skill_info:
                                if "burnEffect" not in skill_data:
                                    skill_data["burnEffect"] = {}

                                for burst_type, burst_data in skill_info["burnEffect"].items():
                                    if burst_type not in skill_data["burnEffect"]:
                                        skill_data["burnEffect"][burst_type] = {}

                                    # Merge new keys
                                    for key, value in burst_data.items():
                                        skill_data["burnEffect"][burst_type][key] = value

                                    # Reorder keys: effect, effect_jp, effect_kr, effect_zh, cost, level
                                    burst_ordered = {}
                                    field_order = ['effect', 'effect_jp', 'effect_kr', 'effect_zh', 'cost', 'level']
                                    for field in field_order:
                                        if field in skill_data["burnEffect"][burst_type]:
                                            burst_ordered[field] = skill_data["burnEffect"][burst_type][field]
                                    # Add any remaining fields
                                    for field in skill_data["burnEffect"][burst_type]:
                                        if field not in burst_ordered:
                                            burst_ordered[field] = skill_data["burnEffect"][burst_type][field]
                                    skill_data["burnEffect"][burst_type] = burst_ordered

                    # Reorder and save
                    ordered_json = self._reorder_char_json(char_data)
                    with open(char_file, 'w', encoding='utf-8') as f:
                        json.dump(ordered_json, f, ensure_ascii=False, indent=2)

                    # Update character-profiles.json with localization data
                    try:
                        fullname_en = char_data.get("Fullname", "")
                        fullname_jp = char_data.get("Fullname_jp", "")
                        fullname_kr = char_data.get("Fullname_kr", "")
                        fullname_zh = char_data.get("Fullname_zh", "")

                        if fullname_en:
                            # Extract or update profile
                            profile = profile_mgr.extract_profile(
                                char_id,
                                fullname_en,
                                fullname_jp or fullname_en,
                                fullname_kr or fullname_en,
                                fullname_zh or fullname_en
                            )

                            if profile:
                                # Update profile in character-profiles.json
                                profile_mgr.update_profile(fullname_en, profile)
                                logger.info(f"Updated character-profiles.json for {fullname_en}")
                    except Exception as profile_err:
                        logger.error(f"Error updating character-profiles.json for {char_id}: {profile_err}")
                        # Don't fail the whole operation if profile update fails

                    success_count += 1
                    logger.info(f"Successfully processed {char_id} ({char_file.name})")

                except Exception as e:
                    logger.error(f"Error processing {char_file.name}: {e}")
                    error_count += 1
                    continue

            # Re-enable UI
            self.do_all_btn.setEnabled(True)
            self.extract_btn.setEnabled(True)
            self.merge_btn.setEnabled(True)

            # Show summary
            summary = (
                f"Batch processing complete!\n\n"
                f"Total: {total}\n"
                f"Success: {success_count}\n"
                f"Errors: {error_count}\n"
                f"Skipped: {skipped_count}"
            )
            self.char_info_label.setText(summary)
            QMessageBox.information(self, "Complete", summary)

            logger.info(f"Do All Characters completed: {success_count} success, {error_count} errors, {skipped_count} skipped")

        except Exception as e:
            logger.exception("Error in _do_all_characters")
            # Re-enable UI
            self.do_all_btn.setEnabled(True)
            self.extract_btn.setEnabled(True)
            self.merge_btn.setEnabled(True)
            raise

    def _do_all_ee(self):
        """Extract and merge localization for all EE entries"""
        try:
            # Get language configuration
            lang_config = self.LANGUAGE_CONFIG[self.current_language]
            suffix = lang_config["suffix"]

            # Load EE JSON file
            EE_DATA_FILE = EE_FILE

            if not EE_DATA_FILE.exists():
                QMessageBox.critical(self, "Error", f"EE data file not found: {EE_DATA_FILE}")
                return

            with open(EE_DATA_FILE, 'r', encoding='utf-8') as f:
                ee_data = json.load(f)

            total = len(ee_data)

            if total == 0:
                QMessageBox.warning(self, "Warning", "No EE entries found")
                return

            # Confirm with user
            reply = QMessageBox.question(
                self,
                "Confirm",
                f"Process all {total} EE entries for {self.current_language} localization?\n\n"
                f"This will extract and merge localization for all EE.",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
            )

            if reply != QMessageBox.StandardButton.Yes:
                return

            # Disable UI during processing
            self.do_all_btn.setEnabled(False)
            self.extract_btn.setEnabled(False)
            self.merge_btn.setEnabled(False)

            success_count = 0
            error_count = 0
            skipped_count = 0

            # Process each EE entry
            for i, (slug, ee_info) in enumerate(ee_data.items(), 1):
                try:
                    # Update status
                    ee_name = ee_info.get("name", slug)
                    self.char_info_label.setText(
                        f"Processing {i}/{total}: {ee_name}..."
                    )
                    QApplication.processEvents()  # Update UI

                    # Find corresponding character file to get hero ID
                    char_file = CHAR_DATA_FOLDER / f"{slug}.json"

                    if not char_file.exists():
                        logger.warning(f"Skipping {slug}: Character file not found")
                        skipped_count += 1
                        continue

                    # Load character data to get ID
                    with open(char_file, 'r', encoding='utf-8') as cf:
                        char_data = json.load(cf)

                    hero_id = char_data.get("ID", "")
                    if not hero_id:
                        logger.warning(f"Skipping {slug}: No ID in character file")
                        skipped_count += 1
                        continue

                    # Extract localization
                    from ee_localization_extractor import EELocalizationExtractor
                    extractor = EELocalizationExtractor(hero_id, lang_config)
                    loc_data = extractor.extract()

                    if not loc_data:
                        logger.warning(f"No localization data extracted for EE {hero_id} (slug: {slug})")
                        skipped_count += 1
                        continue

                    # Merge localization data
                    name_key = f"name{suffix}"
                    if name_key in loc_data:
                        ee_info[name_key] = loc_data[name_key]

                    mainstat_key = f"mainStat{suffix}"
                    if mainstat_key in loc_data:
                        ee_info[mainstat_key] = loc_data[mainstat_key]

                    effect_key = f"effect{suffix}"
                    if effect_key in loc_data:
                        ee_info[effect_key] = loc_data[effect_key]

                    effect10_key = f"effect10{suffix}"
                    if effect10_key in loc_data:
                        ee_info[effect10_key] = loc_data[effect10_key]

                    # Reorder EE keys
                    ee_data[slug] = self._reorder_ee_json(ee_info)

                    success_count += 1
                    logger.info(f"Successfully processed EE {hero_id} (slug: {slug})")

                except Exception as e:
                    logger.error(f"Error processing EE {slug}: {e}")
                    error_count += 1
                    continue

            # Save updated EE data
            with open(EE_DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(ee_data, f, ensure_ascii=False, indent=2)

            # Re-enable UI
            self.do_all_btn.setEnabled(True)
            self.extract_btn.setEnabled(True)
            self.merge_btn.setEnabled(True)

            # Show summary
            summary = (
                f"Batch processing complete!\n\n"
                f"Total: {total}\n"
                f"Success: {success_count}\n"
                f"Errors: {error_count}\n"
                f"Skipped: {skipped_count}"
            )
            self.char_info_label.setText(summary)
            QMessageBox.information(self, "Complete", summary)

            logger.info(f"Do All EE completed: {success_count} success, {error_count} errors, {skipped_count} skipped")

        except Exception as e:
            logger.exception("Error in _do_all_ee")
            # Re-enable UI
            self.do_all_btn.setEnabled(True)
            self.extract_btn.setEnabled(True)
            self.merge_btn.setEnabled(True)
            raise

    def eventFilter(self, obj, event):
        """Event filter to show dropdown on click in editable combo box"""
        if obj == self.char_combo.lineEdit() and event.type() == event.Type.MouseButtonPress:
            self.char_combo.showPopup()
        return super().eventFilter(obj, event)


class GeasTab(QWidget):
    """Tab for extracting Geas data"""

    def __init__(self):
        super().__init__()
        self._setup_ui()

    def _setup_ui(self):
        """Setup the Geas UI"""
        main_layout = QVBoxLayout(self)

        # Info panel
        info_group = QGroupBox("Guild Raid Geas Extraction")
        info_layout = QVBoxLayout()

        info_text = QLabel(
            "Extract Geas data from GuildRaidGeisTemplet.bytes with localized text.\n\n"
            "Features:\n"
            "• Associates NameID with TextSkill for EN, JP, KR, ZH translations\n"
            "• Replaces buff placeholders with actual values\n"
            "• Intelligent duplicate detection\n"
            "• Exports to both ParserV3/export and src/data folders"
        )
        info_text.setWordWrap(True)
        info_layout.addWidget(info_text)

        info_group.setLayout(info_layout)
        main_layout.addWidget(info_group)

        # Controls
        controls_group = QGroupBox("Controls")
        controls_layout = QHBoxLayout()

        self.extract_btn = QPushButton("Extract Geas")
        self.extract_btn.clicked.connect(self._extract_geas)
        self.extract_btn.setMinimumHeight(40)
        controls_layout.addWidget(self.extract_btn)

        controls_group.setLayout(controls_layout)
        main_layout.addWidget(controls_group)

        # Status area
        status_label = QLabel("<b>Status:</b>")
        main_layout.addWidget(status_label)

        self.status_text = QTextEdit()
        self.status_text.setReadOnly(True)
        self.status_text.setMaximumHeight(150)
        self.status_text.setPlainText("Ready to extract. Click 'Extract Geas' to begin.")
        main_layout.addWidget(self.status_text)

        # Preview area
        preview_label = QLabel("<b>JSON Preview (first 50 lines):</b>")
        main_layout.addWidget(preview_label)

        self.preview_text = QTextEdit()
        self.preview_text.setReadOnly(True)
        self.preview_text.setFont(QApplication.font())
        main_layout.addWidget(self.preview_text)

    def _extract_geas(self):
        """Extract geas data"""
        try:
            self.extract_btn.setEnabled(False)
            self.status_text.setPlainText("Extracting geas data...")
            QApplication.processEvents()

            # Import here to avoid circular imports
            from extract_geas import extract_geas

            # Run extraction with silent mode
            stats = extract_geas(silent=True)

            # Check if successful
            if stats['success']:
                # Show success dialog with stats
                self._show_stats_dialog(stats)

                # Load and preview the JSON
                geas_file = Path(__file__).parent / "export" / "geas.json"
                if geas_file.exists():
                    with open(geas_file, "r", encoding="utf-8") as f:
                        lines = f.readlines()
                        preview = "".join(lines[:50])
                        if len(lines) > 50:
                            preview += f"\n... ({len(lines) - 50} more lines)"
                        self.preview_text.setPlainText(preview)

                self.status_text.setPlainText(
                    f"✓ Extraction successful!\n"
                    f"Total entries: {stats['total']}\n"
                    f"New: {stats['new']}\n"
                    f"Skipped: {stats['skipped']}\n"
                    f"Conflicts resolved: {stats['conflicts']}"
                )
            else:
                QMessageBox.critical(
                    self,
                    "Extraction Failed",
                    f"Failed to extract geas data:\n{stats.get('error', 'Unknown error')}"
                )
                self.status_text.setPlainText(f"✗ Error: {stats.get('error', 'Unknown error')}")

        except Exception as e:
            logger.exception("Error extracting geas")
            QMessageBox.critical(self, "Error", f"Failed to extract geas:\n{str(e)}")
            self.status_text.setPlainText(f"✗ Error: {str(e)}")
        finally:
            self.extract_btn.setEnabled(True)

    def _show_stats_dialog(self, stats):
        """Show extraction statistics in a dialog"""
        dialog = QDialog(self)
        dialog.setWindowTitle("Geas Extraction Complete")
        dialog.setMinimumWidth(400)

        layout = QVBoxLayout(dialog)

        # Title
        title = QLabel("<h2>✓ Extraction Complete</h2>")
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(title)

        # Stats table
        stats_group = QGroupBox("Statistics")
        stats_layout = QFormLayout()

        stats_layout.addRow("<b>Total entries:</b>", QLabel(str(stats['total'])))
        stats_layout.addRow("<b>New entries:</b>", QLabel(f"<span style='color: green;'>{stats['new']}</span>"))
        stats_layout.addRow("<b>Skipped (unchanged/duplicates):</b>", QLabel(f"<span style='color: blue;'>{stats['skipped']}</span>"))
        stats_layout.addRow("<b>Conflicts resolved:</b>", QLabel(f"<span style='color: orange;'>{stats['conflicts']}</span>"))

        stats_group.setLayout(stats_layout)
        layout.addWidget(stats_group)

        # Export info
        export_info = QLabel(
            "Files exported to:\n"
            "• datamine/ParserV3/export/geas.json\n"
            "• src/data/geas.json"
        )
        export_info.setWordWrap(True)
        layout.addWidget(export_info)

        # Close button
        close_btn = QPushButton("OK")
        close_btn.clicked.connect(dialog.accept)
        layout.addWidget(close_btn)

        dialog.exec()


class CoreFusionTab(QWidget):
    """Tab for extracting Core Fusion character data"""

    def __init__(self):
        super().__init__()
        self.extracted_data = None
        self.current_fusion_id = None
        self._setup_ui()
        self._load_fusion_characters()

    def _setup_ui(self):
        """Setup the Core Fusion UI"""
        main_layout = QVBoxLayout(self)

        # Top panel: Compact character selector
        top_panel = QWidget()
        top_layout = QHBoxLayout(top_panel)

        # Character selection (compact)
        top_layout.addWidget(QLabel("Character:"))
        self.fusion_combo = QComboBox()
        self.fusion_combo.currentTextChanged.connect(self._on_fusion_char_changed)
        top_layout.addWidget(self.fusion_combo, stretch=1)

        # Manual ID input (compact)
        top_layout.addWidget(QLabel("or ID:"))
        self.fusion_id_input = QLineEdit()
        self.fusion_id_input.setPlaceholderText("2700037")
        self.fusion_id_input.setMaximumWidth(100)
        self.fusion_id_input.returnPressed.connect(self._extract_fusion)
        top_layout.addWidget(self.fusion_id_input)

        # Extract button
        self.extract_btn = QPushButton("Extract")
        self.extract_btn.clicked.connect(self._extract_fusion)
        top_layout.addWidget(self.extract_btn)

        # Save button
        self.save_btn = QPushButton("Save")
        self.save_btn.setEnabled(False)
        self.save_btn.clicked.connect(self._save_fusion)
        top_layout.addWidget(self.save_btn)

        # Info label
        self.info_label = QLabel("Select a Core Fusion character")
        self.info_label.setWordWrap(True)
        top_layout.addWidget(self.info_label, stretch=2)

        main_layout.addWidget(top_panel)

        # Content area with 3 columns: JSON | EE | Images
        content_splitter = QSplitter(Qt.Orientation.Horizontal)

        # Left: JSON Preview
        json_panel = QWidget()
        json_layout = QVBoxLayout(json_panel)
        json_layout.addWidget(QLabel("<b>JSON Preview:</b>"))
        self.content_text = QTextEdit()
        self.content_text.setReadOnly(True)
        self.content_text.setFont(QApplication.font())
        self.content_text.setPlainText("Click Extract to see Core Fusion data...")
        json_layout.addWidget(self.content_text)
        content_splitter.addWidget(json_panel)

        # Middle: EE Section
        ee_panel = QWidget()
        ee_layout = QVBoxLayout(ee_panel)
        ee_layout.addWidget(QLabel("<b>Exclusive Equipment:</b>"))
        self.ee_text = QTextEdit()
        self.ee_text.setReadOnly(True)
        self.ee_text.setPlainText("EE info will appear here after extraction...")
        ee_layout.addWidget(self.ee_text)
        content_splitter.addWidget(ee_panel)

        # Right: Images
        images_panel = QWidget()
        images_layout = QVBoxLayout(images_panel)
        images_layout.addWidget(QLabel("<b>Images:</b>"))

        # Scroll area for displaying images
        self.images_scroll = QScrollArea()
        self.images_scroll.setWidgetResizable(True)
        self.images_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        self.images_scroll.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)

        # Container widget for images
        self.images_container = QWidget()
        self.images_container_layout = QVBoxLayout(self.images_container)
        self.images_container_layout.setAlignment(Qt.AlignmentFlag.AlignTop)

        placeholder_label = QLabel("Images will appear here after extraction...")
        placeholder_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        placeholder_label.setWordWrap(True)
        self.images_container_layout.addWidget(placeholder_label)

        self.images_scroll.setWidget(self.images_container)
        images_layout.addWidget(self.images_scroll)
        content_splitter.addWidget(images_panel)

        # Set sizes - give more space to all panels
        content_splitter.setSizes([500, 400, 400])
        main_layout.addWidget(content_splitter, stretch=1)

    def _load_fusion_characters(self):
        """Load all Core Fusion characters from CharacterTemplet"""
        try:
            cache = CacheManager(BYTES_FOLDER)
            char_data = cache.get_data('CharacterTemplet.bytes')
            text_data = cache.get_data('TextCharacter.bytes')

            # Build text index
            text_index = {t.get('IDSymbol'): t for t in text_data if t.get('IDSymbol')}

            # Find all characters starting with 27
            fusion_chars = []
            for char in char_data:
                char_id = char.get('ID', '')
                if char_id.startswith('27'):
                    name_id = char.get('NameID')
                    name_text = text_index.get(name_id, {})
                    char_name = name_text.get('EN', f'Unknown ({char_id})')

                    fusion_chars.append({
                        'id': char_id,
                        'name': char_name,
                        'display': f"{char_name} (ID: {char_id})"
                    })

            # Sort by ID
            fusion_chars.sort(key=lambda x: x['id'])

            # Populate combo box
            self.fusion_combo.clear()
            self.fusion_combo.addItem("-- Select --", None)
            for char in fusion_chars:
                self.fusion_combo.addItem(char['display'], char['id'])

            if fusion_chars:
                self.info_label.setText(f"Found {len(fusion_chars)} Core Fusion character(s)")
            else:
                self.info_label.setText("No Core Fusion characters found in game data")

        except Exception as e:
            logger.exception("Error loading Core Fusion characters")
            self.info_label.setText(f"Error loading characters: {str(e)}")

    def _on_fusion_char_changed(self, text):
        """Handle fusion character selection change"""
        current_index = self.fusion_combo.currentIndex()
        if current_index > 0:  # Not "-- Select --"
            fusion_id = self.fusion_combo.itemData(current_index)
            self.fusion_id_input.setText(fusion_id)
            self.current_fusion_id = fusion_id
        else:
            self.fusion_id_input.clear()
            self.current_fusion_id = None

    def _extract_fusion(self):
        """Extract Core Fusion character data"""
        # Get ID from input or combo
        fusion_id = self.fusion_id_input.text().strip()
        if not fusion_id:
            QMessageBox.warning(self, "No ID", "Please select a character or enter an ID")
            return

        try:
            self.extract_btn.setEnabled(False)
            self.info_label.setText(f"Extracting Core Fusion character {fusion_id}...")
            QApplication.processEvents()

            # Extract using FusionExtractor
            extractor = FusionExtractor(fusion_id)
            self.extracted_data = extractor.extract()

            # Display JSON
            json_str = json.dumps(self.extracted_data, indent=2, ensure_ascii=False)
            self.content_text.setPlainText(json_str)

            # Display EE info from ee.json
            from text_utils import to_kebab_case
            char_fullname = self.extracted_data.get('Fullname', '')
            ee_key = to_kebab_case(char_fullname)

            # Load ee.json
            ee_json_path = EE_FILE
            try:
                with open(ee_json_path, 'r', encoding='utf-8') as f:
                    ee_data = json.load(f)
                    ee_info = ee_data.get(ee_key, {})

                if ee_info and ee_info.get('name'):
                    # EE data found
                    ee_text = f"=== Exclusive Equipment ===\n\n"
                    ee_text += f"Name: {ee_info.get('name', 'N/A')}\n"
                    ee_text += f"Name (JP): {ee_info.get('name_jp', 'N/A')}\n"
                    ee_text += f"Name (KR): {ee_info.get('name_kr', 'N/A')}\n\n"
                    ee_text += f"Main Stat: {ee_info.get('mainStat', 'N/A')}\n"
                    ee_text += f"Main Stat (JP): {ee_info.get('mainStat_jp', 'N/A')}\n"
                    ee_text += f"Main Stat (KR): {ee_info.get('mainStat_kr', 'N/A')}\n\n"
                    ee_text += f"Effect:\n{ee_info.get('effect', 'N/A')}\n\n"
                    ee_text += f"Effect (JP):\n{ee_info.get('effect_jp', 'N/A')}\n\n"
                    ee_text += f"Effect (KR):\n{ee_info.get('effect_kr', 'N/A')}\n\n"
                    ee_text += f"Effect +10:\n{ee_info.get('effect10', 'N/A')}\n\n"
                    ee_text += f"Effect +10 (JP):\n{ee_info.get('effect10_jp', 'N/A')}\n\n"
                    ee_text += f"Effect +10 (KR):\n{ee_info.get('effect10_kr', 'N/A')}\n\n"
                    ee_text += f"Rank: {ee_info.get('rank', '(empty - manual)')}\n"
                else:
                    # No EE data
                    ee_text = f"No EE data found in ee.json for key: {ee_key}"
            except Exception as e:
                ee_text = f"Error loading ee.json: {e}"

            self.ee_text.setPlainText(ee_text)

            # Display Images
            self._display_character_images(self.extracted_data)

            # Enable save button
            self.save_btn.setEnabled(True)

            char_name = self.extracted_data.get('Fullname', 'Unknown')
            original_id = self.extracted_data.get('originalCharacter', 'Unknown')
            fusion_levels = len(self.extracted_data.get('fusionLevels', []))

            self.info_label.setText(
                f"✓ Extracted: {char_name}\n"
                f"Original Character: {original_id} | Fusion Levels: {fusion_levels}\n"
                f"✓ Original character JSON updated with Core Fusion link"
            )

            logger.info(f"Core Fusion extraction successful: {fusion_id} -> {char_name}")

        except Exception as e:
            logger.exception(f"Error extracting Core Fusion {fusion_id}")
            QMessageBox.critical(self, "Error", f"Failed to extract Core Fusion:\n{str(e)}")
            self.info_label.setText(f"Error: {str(e)}")
        finally:
            self.extract_btn.setEnabled(True)

    def _display_character_images(self, data):
        """Display character images in the images panel"""
        # Clear existing images
        while self.images_container_layout.count():
            child = self.images_container_layout.takeAt(0)
            if child.widget():
                child.widget().deleteLater()

        char_id = data.get('ID', '')
        if not char_id:
            error_label = QLabel("No character ID found")
            error_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
            self.images_container_layout.addWidget(error_label)
            return

        # Base paths for images
        public_images = PUBLIC_CHARACTERS

        # Define images to display
        images_to_show = [
            ("Portrait", public_images / "portrait" / f"CT_{char_id}.png"),
            ("ATB", public_images / "atb" / f"IG_Turn_{char_id}.png"),
            ("ATB (Evolved)", public_images / "atb" / f"IG_Turn_{char_id}_E.png"),
            ("Full Art", public_images / "full" / f"IMG_{char_id}.png"),
            ("Cutin", public_images / "cutin" / f"T_CutIn_{char_id}.png"),
        ]

        # Add skill icons
        skills_dir = public_images / "skills"
        if skills_dir.exists():
            for skill_file in sorted(skills_dir.glob(f"Skill_*_{char_id}.png")):
                skill_name = skill_file.stem.replace(f"_{char_id}", "").replace("_", " ")
                images_to_show.append((skill_name, skill_file))

        # Add EX equipment image if available
        from text_utils import to_kebab_case
        char_fullname = data.get('Fullname', '')
        if char_fullname:
            ex_filename = to_kebab_case(char_fullname) + ".png"
            images_to_show.append(("EX Equipment", public_images / "ex" / ex_filename))

        # Display each image
        for img_name, img_path in images_to_show:
            if img_path.exists():
                # Create container for this image
                img_widget = QWidget()
                img_layout = QVBoxLayout(img_widget)
                img_layout.setContentsMargins(5, 5, 5, 5)

                # Label with image name
                label = QLabel(f"<b>{img_name}</b>")
                label.setAlignment(Qt.AlignmentFlag.AlignCenter)
                img_layout.addWidget(label)

                # Load and display image
                pixmap = QPixmap(str(img_path))
                if not pixmap.isNull():
                    # Scale image if too large (max width 350px)
                    if pixmap.width() > 350:
                        pixmap = pixmap.scaledToWidth(350, Qt.TransformationMode.SmoothTransformation)

                    img_label = QLabel()
                    img_label.setPixmap(pixmap)
                    img_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
                    img_layout.addWidget(img_label)
                else:
                    # Failed to load image
                    error_label = QLabel(f"Failed to load image")
                    error_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
                    img_layout.addWidget(error_label)

                self.images_container_layout.addWidget(img_widget)
            else:
                # Image doesn't exist - skip it silently
                pass

        # Add stretch at the end to keep images at the top
        self.images_container_layout.addStretch()

    def _save_fusion(self):
        """Save Core Fusion data to src/data/char/"""
        if not self.extracted_data:
            QMessageBox.warning(self, "No Data", "No extracted data to save")
            return

        try:
            # Generate filename from character name
            char_name = self.extracted_data.get('Fullname', '')
            # Remove "Core Fusion " prefix for filename
            if char_name.startswith('Core Fusion '):
                base_name = char_name.replace('Core Fusion ', '')
            else:
                base_name = char_name

            filename = f"core-fusion-{to_kebab_case(base_name)}.json"
            output_path = CHAR_DATA_FOLDER / filename

            # Save JSON
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(self.extracted_data, f, indent=2, ensure_ascii=False)

            QMessageBox.information(
                self,
                "Success",
                f"Core Fusion data saved to:\n{output_path}\n\n"
                f"Don't forget to add the link to the original character JSON:\n"
                f'"hasCoreFusion": true,\n'
                f'"coreFusionId": "{self.extracted_data.get("ID")}"'
            )

            self.info_label.setText(f"✓ Saved to: {filename}")
            logger.info(f"Core Fusion data saved: {output_path}")

        except Exception as e:
            logger.exception("Error saving Core Fusion data")
            QMessageBox.critical(self, "Error", f"Failed to save:\n{str(e)}")


class EquipmentTab(QWidget):
    """Tab for extracting equipment data (Weapons, Amulettes, Sets, Talisman)"""

    def __init__(self):
        super().__init__()
        self.current_mode = "Weapons"  # Default mode
        self.extracted_data = None
        self._setup_ui()

    def _setup_ui(self):
        """Setup the Equipment UI"""
        main_layout = QVBoxLayout(self)

        # Top panel: Mode selector
        top_panel = QWidget()
        top_layout = QHBoxLayout(top_panel)

        # Mode selection
        mode_group = QGroupBox("Equipment Type")
        mode_layout = QVBoxLayout()

        self.mode_combo = QComboBox()
        self.mode_combo.addItems(["Weapons", "Amulets", "Sets", "Talisman"])
        self.mode_combo.currentTextChanged.connect(self._on_mode_changed)
        mode_layout.addWidget(self.mode_combo)

        mode_group.setLayout(mode_layout)
        top_layout.addWidget(mode_group)

        # Controls
        controls_group = QGroupBox("Controls")
        controls_layout = QVBoxLayout()

        self.extract_btn = QPushButton("Extract")
        self.extract_btn.clicked.connect(self._extract_equipment)
        controls_layout.addWidget(self.extract_btn)

        self.save_btn = QPushButton("Save to JSON")
        self.save_btn.setEnabled(False)
        self.save_btn.clicked.connect(self._save_weapons)
        controls_layout.addWidget(self.save_btn)

        self.info_label = QLabel("Click Extract to load equipment data")
        self.info_label.setWordWrap(True)
        controls_layout.addWidget(self.info_label)

        controls_group.setLayout(controls_layout)
        top_layout.addWidget(controls_group)

        main_layout.addWidget(top_panel)

        # Content area
        content_label = QLabel("<b>Equipment Data (JSON Preview):</b>")
        main_layout.addWidget(content_label)

        self.content_text = QTextEdit()
        self.content_text.setReadOnly(True)
        self.content_text.setFont(QApplication.font())
        self.content_text.setPlainText("Click Extract to see data...")
        main_layout.addWidget(self.content_text)

    def _on_mode_changed(self, mode: str):
        """Handle mode change"""
        self.current_mode = mode
        self.info_label.setText(f"Mode: {mode} - Click Extract to load")
        self.content_text.setPlainText(f"Mode changed to {mode}. Click Extract to load data.")
        logger.info(f"Equipment mode changed to: {mode}")

    def _extract_equipment(self):
        """Extract equipment data based on current mode"""
        try:
            self.extract_btn.setEnabled(False)
            self.info_label.setText(f"Extracting {self.current_mode}...")
            QApplication.processEvents()

            if self.current_mode == "Weapons":
                self._extract_weapons()
            elif self.current_mode == "Amulets":
                self._extract_amulets()
            elif self.current_mode == "Sets":
                self._extract_sets()
            elif self.current_mode == "Talisman":
                self._extract_talismans()
            else:
                self.content_text.setPlainText(f"{self.current_mode} extraction not implemented yet.")
                self.info_label.setText(f"{self.current_mode} - Not implemented")

        except Exception as e:
            logger.exception(f"Error extracting {self.current_mode}")
            QMessageBox.critical(self, "Error", f"Failed to extract {self.current_mode}:\n{str(e)}")
            self.info_label.setText(f"Error: {str(e)}")
        finally:
            self.extract_btn.setEnabled(True)

    def _build_namesymbol_to_boss_mapping(self, dungeon_data, text_system_index):
        """
        Build NameSymbol -> Boss name mapping from dungeon data.
        Returns a dict like: {"110": {"boss": "Boss Name", "mode": "DM_RAID_2"}, ...}

        NOTE: Only maps RAID_2 bosses for weapons (110, 120, 130, 140, 150).
        RAID_1 bosses (109, 119, 129, 139, 149) drop armors, not weapons.

        The order is based on element prefixes in SeasonFullName:
        F (Fire), W (Water), E (Earth), L (Light), D (Dark)
        """
        # Extract boss names with their element prefix from RAID_2
        boss_by_prefix = {}

        for d in dungeon_data:
            mode = d.get("DungeonMode", "")
            if mode == "DM_RAID_2":
                season_name = d.get("SeasonFullName", "")
                dungeon_name = text_system_index.get(season_name, {}).get("English", "")
                if "Stage" in dungeon_name:
                    boss_name = dungeon_name.split("(Stage")[0].strip()

                    # Extract element prefix (D, E, F, L, W)
                    if season_name.startswith("SYS_RAID_2_DUNGEON_"):
                        prefix = season_name.replace("SYS_RAID_2_DUNGEON_", "")[0]
                        boss_by_prefix[prefix] = boss_name

        # Element order: Fire, Water, Earth, Light, Dark
        # Maps to NameSymbols: 110, 120, 130, 140, 150
        element_order = ["F", "W", "E", "L", "D"]

        # Build mapping using element order
        mapping = {}
        for i, prefix in enumerate(element_order):
            if prefix in boss_by_prefix:
                namesymbol = str(110 + i * 10)
                boss_name = boss_by_prefix[prefix]
                mapping[namesymbol] = {"boss": boss_name, "mode": "DM_RAID_2"}

        return mapping

    def _build_set_groupid_to_boss_mapping(self, reward_view_data, dungeon_data, text_system_index):
        """
        Build set GroupID -> Boss name mapping.
        Returns a dict like: {"1": {"boss": "Boss Name", "mode": "DM_RAID_1"}, ...}

        Sets drop from RAID_1 bosses. NameSymbols 1-50 map to bosses:
        - 1-10: Earth boss
        - 11-20: Water boss
        - 21-30: Fire boss
        - 31-40: Light boss
        - 41-50: Dark boss
        """
        from collections import defaultdict

        # Extract RAID_1 boss names with their element prefix
        boss_by_prefix = {}
        for d in dungeon_data:
            mode = d.get("DungeonMode", "")
            if mode == "DM_RAID_1":
                season_name = d.get("SeasonFullName", "")
                dungeon_name = text_system_index.get(season_name, {}).get("English", "")
                if "Stage" in dungeon_name:
                    boss_name = dungeon_name.split("(Stage")[0].strip()
                    # Extract element prefix (E, W, F, L, D)
                    if season_name.startswith("SYS_RAID_1_DUNGEON_"):
                        prefix = season_name.replace("SYS_RAID_1_DUNGEON_", "")[0]
                        boss_by_prefix[prefix] = boss_name

        # Build NameSymbol -> Boss mapping for sets
        # NameSymbol 1-10 = Earth, 11-20 = Water, 21-30 = Fire, 31-40 = Light, 41-50 = Dark
        namesymbol_to_boss = {}
        element_ranges = [
            ("E", range(1, 11)),    # Earth: 1-10
            ("W", range(11, 21)),   # Water: 11-20
            ("F", range(21, 31)),   # Fire: 21-30
            ("L", range(31, 41)),   # Light: 31-40
            ("D", range(41, 51))    # Dark: 41-50
        ]

        for prefix, namesymbol_range in element_ranges:
            if prefix in boss_by_prefix:
                boss_name = boss_by_prefix[prefix]
                for ns in namesymbol_range:
                    namesymbol_to_boss[str(ns)] = {"boss": boss_name}

        # Build GroupID -> NameSymbol mapping from RewardViewTemplet
        groupid_to_namesymbols = defaultdict(set)
        for rv in reward_view_data:
            namesymbol = rv.get("NameSymbol", "")
            set_option_id = rv.get("SetOptionID", "")

            if set_option_id and namesymbol:
                # Split comma-separated set IDs
                for set_id in set_option_id.split(","):
                    set_id = set_id.strip()
                    if set_id and set_id != "0":
                        groupid_to_namesymbols[set_id].add(namesymbol)

        # Map GroupID to boss (use first NameSymbol found for each GroupID)
        groupid_to_boss = {}
        for group_id, namesymbols in groupid_to_namesymbols.items():
            # Get the first valid namesymbol that has a boss mapping
            for ns in sorted(namesymbols, key=lambda x: int(x) if x.isdigit() else 0):
                if ns in namesymbol_to_boss:
                    groupid_to_boss[group_id] = namesymbol_to_boss[ns]
                    break

        return groupid_to_boss

    def _extract_weapons(self):
        """Extract weapons from ItemTemplet.bytes"""
        from cache_manager import CacheManager

        # Load data files
        bytes_folder = BYTES_FOLDER
        cache = CacheManager(bytes_folder)

        item_data = cache.get_data("ItemTemplet.bytes")
        special_option_data = cache.get_data("ItemSpecialOptionTemplet.bytes")
        text_skill_data = cache.get_data("TextSkill.bytes")
        buff_data = cache.get_data("BuffTemplet.bytes")
        text_item_data = cache.get_data("TextItem.bytes")
        dungeon_data = cache.get_data("DungeonTemplet.bytes")
        text_system_data = cache.get_data("TextSystem.bytes")
        reward_view_data = cache.get_data("RewardViewTemplet.bytes")
        reward_group_data = cache.get_data("RewardGroupTemplet.bytes")

        # Data for Irregular weapons
        irregular_chase_data = cache.get_data("IrregularChaseTemplet.bytes")
        monster_data = cache.get_data("MonsterTemplet.bytes")
        text_char_data = cache.get_data("TextCharacter.bytes")

        # Build indexes
        text_char_index = {}
        for text in text_char_data:
            symbol = text.get("IDSymbol", "")
            if symbol:
                text_char_index[symbol] = text

        special_option_index = {}
        for opt in special_option_data:
            opt_id = opt.get("ID", "")
            if opt_id:
                special_option_index[opt_id] = opt

        text_skill_index = {}
        for text in text_skill_data:
            symbol = text.get("IDSymbol", "")
            if symbol:
                text_skill_index[symbol] = text

        text_item_index = {}
        for text in text_item_data:
            symbol = text.get("IDSymbol", "")
            if symbol:
                text_item_index[symbol] = text

        text_system_index = {}
        for text in text_system_data:
            symbol = text.get("IDSymbol", "")
            if symbol:
                text_system_index[symbol] = text

        # Build NameSymbol -> Boss name mapping dynamically from dungeon data
        namesymbol_to_boss = self._build_namesymbol_to_boss_mapping(dungeon_data, text_system_index)

        # Build dungeon index: DungeonMode + boss name -> dungeon info
        dungeon_boss_map = {}
        for d in dungeon_data:
            mode = d.get("DungeonMode", "")
            if mode in ["DM_RAID_1", "DM_RAID_2"]:
                name_symbol = d.get("SeasonFullName", "")
                if name_symbol in text_system_index:
                    name = text_system_index[name_symbol].get("English", "")
                    if "Stage" in name:
                        # Extract boss name and stage
                        boss_name = name.split("(Stage")[0].strip()
                        stage_str = name.split("Stage")[-1].strip().rstrip(")")
                        try:
                            stage = int(stage_str)
                        except:
                            stage = 0

                        # Only keep stage 10+ (drops 6-star)
                        if stage >= 10:
                            key = f"{mode}_{boss_name}"
                            if key not in dungeon_boss_map:
                                source_name = "Special Request: Identification" if mode == "DM_RAID_2" else "Special Request: Ecology Study"
                                dungeon_boss_map[key] = {
                                    "boss": boss_name,
                                    "source": "Special Request",
                                    "mode": "Identification" if mode == "DM_RAID_2" else "Ecology Study",
                                    "stages": [],
                                    "reward_ids": []
                                }

                            dungeon_boss_map[key]["stages"].append(stage)
                            reward_id = d.get("RewardID", "")
                            if reward_id:
                                dungeon_boss_map[key]["reward_ids"].append(reward_id)

        # Build buff index by BuffID and Level
        buff_index = {}
        for buff in buff_data:
            buff_id = buff.get("BuffID", "")
            level = buff.get("Level", "")
            if buff_id:
                key = f"{buff_id}_{level}"
                buff_index[key] = buff

        # Filter: ItemType = IT_EQUIP AND ItemSubType = ITS_EQUIP_WEAPON AND BasicStar >= 5
        weapons = []
        for item in item_data:
            item_type = item.get("ItemType", "")
            item_subtype = item.get("ItemSubType", "")
            basic_star = item.get("BasicStar", "")
            weapon_id = item.get("ID", "")

            # Filter: weapon type and 5+ star rarity
            if item_type != "IT_EQUIP" or item_subtype != "ITS_EQUIP_WEAPON":
                continue

            try:
                star_level = int(basic_star) if basic_star else 0
            except (ValueError, TypeError):
                star_level = 0

            if star_level < 5:
                continue

            # Continue with extraction
            # Extract weapon name from TextItem using DescIDSymbol
            desc_id_symbol = item.get("DescIDSymbol", "")
            weapon_names = {}
            if desc_id_symbol and desc_id_symbol in text_item_index:
                name_text = text_item_index[desc_id_symbol]
                weapon_names["name"] = name_text.get("English", "")
                weapon_names["name_jp"] = name_text.get("Japanese", "")
                weapon_names["name_kr"] = name_text.get("Korean", "")
                weapon_names["name_zh"] = name_text.get("China_Simplified", "")

            # Map ItemGrade to rarity
            item_grade = item.get("ItemGrade", "")
            rarity_map = {
                "IG_UNIQUE": "legendary",
                "IG_RARE": "epic",
                "IG_MAGIC": "rare",
                "IG_NORMAL": "common"
            }
            rarity = rarity_map.get(item_grade, "unknown")

            # Map TrustLevelLimit to class
            trust_level = item.get("TrustLevelLimit", "")
            class_map = {
                "CCT_ATTACKER": "Striker",
                "CCT_DEFENDER": "Defender",
                "CCT_RANGER": "Ranger",
                "CCT_SUPPORTER": "Support",
                "CCT_MAGE": "Mage",
                "CCT_PRIEST": "Healer"
            }
            char_class = class_map.get(trust_level, None)

            # Get MainOptionGroupID and lookup special options
            main_option_group = item.get("MainOptionGroupID", "")
            option_ids = [x.strip() for x in str(main_option_group).split(",") if x.strip()]

            # Get special options for this weapon
            weapon_option = None
            for opt_id in option_ids:
                if opt_id in special_option_index:
                    opt = special_option_index[opt_id]
                    # Skip set options (ST_Set_), keep weapon/event options (UO_WEAPON_, UO_EVENT_)
                    name_symbol = opt.get("NameIDSymbol", "")

                    if name_symbol.startswith("UO_WEAPON_") or name_symbol.startswith("UO_EVENT_"):
                        weapon_option = opt
                        break

            # Extract effect data from TextSkill
            effect_data = {}
            if weapon_option:
                name_symbol = weapon_option.get("NameIDSymbol", "")
                # For event weapons, use CustomCraftDescIDSymbol instead of DescID
                desc_symbol = weapon_option.get("DescID", "") or weapon_option.get("CustomCraftDescIDSymbol", "")

                # Get effect name (all languages)
                if name_symbol in text_skill_index:
                    name_text = text_skill_index[name_symbol]
                    effect_data["effect_name"] = name_text.get("English", "")
                    effect_data["effect_name_jp"] = name_text.get("Japanese", "")
                    effect_data["effect_name_kr"] = name_text.get("Korean", "")
                    effect_data["effect_name_zh"] = name_text.get("China_Simplified", "")

                # Get effect description (all languages)
                # Try multiple formats: DESC_LV1, DESC, DESC with level suffix
                desc_base = desc_symbol
                desc_lv1 = f"{desc_symbol}_LV1"
                desc_lv4 = f"{desc_symbol}_LV4"

                # Try LV1 suffix first, then base
                if desc_lv1 in text_skill_index:
                    desc_text_lv1 = text_skill_index[desc_lv1]
                elif desc_base in text_skill_index:
                    desc_text_lv1 = text_skill_index[desc_base]
                else:
                    desc_text_lv1 = None

                # Get buff values for level 1 and 5 (tier 0 and tier 4/max upgrade)
                # Note: BuffID can contain multiple IDs separated by comma (e.g., "BID_A,BID_B")
                buff_id_raw = weapon_option.get("BuffID", "")
                buff_ids = [bid.strip() for bid in buff_id_raw.split(",") if bid.strip()]

                # Try to find buff_lv1 and buff_lv5 from any of the BuffIDs
                buff_lv1 = None
                buff_lv5 = None
                for buff_id in buff_ids:
                    if not buff_lv1:
                        buff_lv1 = buff_index.get(f"{buff_id}_1")
                    if not buff_lv5:
                        buff_lv5 = buff_index.get(f"{buff_id}_5")
                    if buff_lv1 and buff_lv5:
                        break

                # Replace placeholders with actual values
                def replace_placeholders(text, buff):
                    if not text or not buff:
                        return text

                    # [Value], [+Value], [-Value]
                    value = buff.get("Value", "")
                    applying_type = buff.get("ApplyingType", "")
                    if value and value != "OAT_NONE":
                        try:
                            val_int = int(value)
                            # Check if it's a rate/percentage based on ApplyingType
                            if applying_type == "OAT_RATE":
                                # Always divide by 10 for rates (25 -> 2.5%, 50 -> 5%)
                                val_float = val_int / 10
                                # Format nicely: remove .0 if whole number
                                if val_float == int(val_float):
                                    value_str = f"{int(val_float)}%"
                                else:
                                    value_str = f"{val_float}%"
                            elif val_int % 10 == 0:  # Likely a percentage (250 -> 25%)
                                value_str = f"{val_int // 10}%"
                            else:
                                value_str = str(val_int)
                        except:
                            value_str = str(value)

                        text = text.replace("[Value]", value_str)
                        text = text.replace("[+Value]", f"+{value_str}")
                        # For [-Value], don't add "-" prefix as English text already contains "reduce by"
                        text = text.replace("[-Value]", value_str)

                    # [Rate] or [RATE] - from CreateRate
                    create_rate = buff.get("CreateRate", "")
                    if create_rate and create_rate != "OAT_NONE":
                        try:
                            rate_int = int(create_rate)
                            rate_str = f"{rate_int // 10}%"
                        except:
                            rate_str = str(create_rate)
                        text = text.replace("[Rate]", rate_str)
                        text = text.replace("[RATE]", rate_str)

                    # [Turn] - from TurnDuration
                    turn_duration = buff.get("TurnDuration", "")
                    if turn_duration:
                        text = text.replace("[Turn]", str(turn_duration))

                    # [Turn2] - from BuffStartCool (cooldown between activations)
                    buff_start_cool = buff.get("BuffStartCool", "")
                    if buff_start_cool:
                        text = text.replace("[Turn2]", str(buff_start_cool))

                    return text

                if desc_text_lv1:
                    # Remove " -" before numbers for all languages
                    effect_data["effect_desc1"] = replace_placeholders(desc_text_lv1.get("English", ""), buff_lv1).replace(" -", " ")
                    effect_data["effect_desc1_jp"] = replace_placeholders(desc_text_lv1.get("Japanese", ""), buff_lv1).replace(" -", " ").replace("-", "")
                    effect_data["effect_desc1_kr"] = replace_placeholders(desc_text_lv1.get("Korean", ""), buff_lv1).replace(" -", " ").replace("-", "")
                    effect_data["effect_desc1_zh"] = replace_placeholders(desc_text_lv1.get("China_Simplified", ""), buff_lv1).replace("-", "")

                # For level 4: use same text but with level 5 buff values (max upgrade)
                if desc_text_lv1 and buff_lv5:
                    effect_data["effect_desc4"] = replace_placeholders(desc_text_lv1.get("English", ""), buff_lv5).replace(" -", " ")
                    effect_data["effect_desc4_jp"] = replace_placeholders(desc_text_lv1.get("Japanese", ""), buff_lv5).replace(" -", " ").replace("-", "")
                    effect_data["effect_desc4_kr"] = replace_placeholders(desc_text_lv1.get("Korean", ""), buff_lv5).replace(" -", " ").replace("-", "")
                    effect_data["effect_desc4_zh"] = replace_placeholders(desc_text_lv1.get("China_Simplified", ""), buff_lv5).replace("-", "")

                # Get effect icon
                effect_data["effect_icon"] = weapon_option.get("BuffLevel_4P", "")

            # Find boss/source info for this weapon
            weapon_id = item.get("ID", "")

            # Get item IconName for the image field
            item_icon = item.get("IconName", "")

            # Detect weapon source type based on option NameIDSymbol
            weapon_source_type = None
            if weapon_option:
                option_name_symbol = weapon_option.get("NameIDSymbol", "")
                if option_name_symbol.startswith("UO_EVENT_"):
                    weapon_source_type = "event"
                elif "LICENSE" in option_name_symbol:
                    weapon_source_type = "license"

            # Manual mapping for Irregular weapons
            # Irregular weapons (Briareos 781-785, Gorgon 786-790) all use the same source/mode
            irregular_weapon_ids = ["781", "782", "783", "784", "785", "786", "787", "788", "789", "790"]

            # For Event weapons
            if weapon_source_type == "event":
                weapon_entry = {
                    **weapon_names,  # name, name_jp, name_kr, name_zh
                    "type": "weapon",
                    "rarity": rarity,
                    "image": item_icon,
                    **effect_data,  # effect_name, effect_name_jp/kr/zh, effect_desc1, effect_desc1_jp/kr/zh, effect_desc4, effect_desc4_jp/kr/zh, effect_icon
                    "class": char_class,
                    "source": "Event Shop",
                    "boss": None,
                    "mode": "Event",
                    "level": int(basic_star) if basic_star else None
                }
                weapons.append(weapon_entry)
            # For License/Pass weapons
            elif weapon_source_type == "license":
                weapon_entry = {
                    **weapon_names,  # name, name_jp, name_kr, name_zh
                    "type": "weapon",
                    "rarity": rarity,
                    "image": item_icon,
                    **effect_data,  # effect_name, effect_name_jp/kr/zh, effect_desc1, effect_desc1_jp/kr/zh, effect_desc4, effect_desc4_jp/kr/zh, effect_icon
                    "class": char_class,
                    "source": "Adventure License",
                    "boss": None,
                    "mode": "License Shop",
                    "level": int(basic_star) if basic_star else None
                }
                weapons.append(weapon_entry)
            # For Irregular weapons, create one entry with fixed source/boss/mode
            elif weapon_id in irregular_weapon_ids:
                weapon_entry = {
                    **weapon_names,  # name, name_jp, name_kr, name_zh
                    "type": "weapon",
                    "rarity": rarity,
                    "image": item_icon,
                    **effect_data,  # effect_name, effect_name_jp/kr/zh, effect_desc1, effect_desc1_jp/kr/zh, effect_desc4, effect_desc4_jp/kr/zh, effect_icon
                    "class": char_class,
                    "source": "Irregular Extermination",
                    "boss": None,
                    "mode": "Infiltration Operation / Pursuit Operation",
                    "level": int(basic_star) if basic_star else None
                }
                weapons.append(weapon_entry)
            else:
                # For Special Request weapons, get all NameSymbols this weapon appears in
                # (Steel Sword appears in all 5 boss reward views)
                weapon_namesymbols = set()  # Use set to avoid duplicates
                for rv in reward_view_data:
                    icon = rv.get("Icon", "")
                    if icon == "TI_Equipment_Weapon_06":
                        min_id = rv.get("MinItemID", "")
                        max_id = rv.get("MaxItemID", "")
                        name_symbol = rv.get("NameSymbol", "")

                        # Check if weapon_id is in the range [min_id, max_id]
                        if name_symbol in namesymbol_to_boss and min_id and max_id:
                            try:
                                weapon_id_int = int(weapon_id)
                                min_id_int = int(min_id)
                                max_id_int = int(max_id)

                                if min_id_int <= weapon_id_int <= max_id_int:
                                    weapon_namesymbols.add(name_symbol)
                            except (ValueError, TypeError):
                                pass

                # Create one entry per boss (for Steel Sword, this creates 5 entries)
                if weapon_namesymbols:
                    for name_symbol in weapon_namesymbols:
                        boss_info = namesymbol_to_boss[name_symbol]
                        boss = boss_info["boss"]

                        weapon_entry = {
                            **weapon_names,  # name, name_jp, name_kr, name_zh
                            "type": "weapon",
                            "rarity": rarity,
                            "image": item_icon,
                            **effect_data,  # effect_name, effect_name_jp/kr/zh, effect_desc1, effect_desc1_jp/kr/zh, effect_desc4, effect_desc4_jp/kr/zh, effect_icon
                            "class": char_class,
                            "source": "Special Request",
                            "boss": boss,
                            "mode": None,
                            "level": int(basic_star) if basic_star else None
                        }
                        weapons.append(weapon_entry)
                else:
                    # No NameSymbol mapping found - create single entry with unknown source
                    weapon_entry = {
                        **weapon_names,  # name, name_jp, name_kr, name_zh
                        "type": "weapon",
                        "rarity": rarity,
                        "image": item_icon,
                        **effect_data,  # effect_name, effect_name_jp/kr/zh, effect_desc1, effect_desc1_jp/kr/zh, effect_desc4, effect_desc4_jp/kr/zh, effect_icon
                        "class": char_class,
                        "source": None,
                        "boss": None,
                        "mode": None,
                        "level": int(basic_star) if basic_star else None
                    }
                    weapons.append(weapon_entry)

        # Post-processing filters:
        # 1. Remove Steel Sword, Fine Sword, Ordinary Sword
        # 2. If a weapon exists in 6-star, remove 5-star versions
        # 3. Remove unmapped weapons (source/boss/mode null) if same effect exists elsewhere

        # Filter out unwanted weapons by name
        excluded_names = ["Steel Sword", "Fine Sword", "Ordinary Sword", "Ether Blade", "Hunter Blade Ver. 2.0", "Hunter Blade Ver. 1.0"]
        weapons = [w for w in weapons if w.get("name", "").split("[")[0].strip() not in excluded_names]

        # Group by base name (without class suffix like [Striker])
        weapons_by_base_name = {}
        for w in weapons:
            # Extract base name (e.g., "Surefire Javelin" from "Surefire Javelin [Striker]")
            full_name = w.get("name", "")
            base_name = full_name.split("[")[0].strip() if "[" in full_name else full_name

            if base_name not in weapons_by_base_name:
                weapons_by_base_name[base_name] = []
            weapons_by_base_name[base_name].append(w)

        # For each base name, if there are both 5-star and 6-star versions, keep only 6-star
        filtered_weapons = []
        for base_name, weapon_list in weapons_by_base_name.items():
            # Check if there are any 6-star versions
            has_6_star = any(w.get("level") == 6 for w in weapon_list)

            if has_6_star:
                # Keep only 6-star versions
                filtered_weapons.extend([w for w in weapon_list if w.get("level") == 6])
            else:
                # Keep all versions (5-star only)
                filtered_weapons.extend(weapon_list)

        weapons = filtered_weapons

        # Remove unmapped weapons if same effect exists in a mapped weapon
        # Build a set of effect signatures for mapped weapons (weapons with source/boss/mode)
        mapped_effect_signatures = set()
        for w in weapons:
            source = w.get("source")
            boss = w.get("boss")
            mode = w.get("mode")
            # Consider a weapon "mapped" if it has at least a source
            if source:
                effect_desc1 = w.get("effect_desc1", "")
                effect_desc4 = w.get("effect_desc4", "")
                # Create signature: combination of both descriptions
                signature = (effect_desc1, effect_desc4)
                mapped_effect_signatures.add(signature)

        # Filter out unmapped weapons with duplicate effects
        final_weapons = []
        for w in weapons:
            source = w.get("source")
            boss = w.get("boss")
            mode = w.get("mode")

            # If weapon is unmapped (no source)
            if not source and not boss and not mode:
                effect_desc1 = w.get("effect_desc1", "")
                effect_desc4 = w.get("effect_desc4", "")
                signature = (effect_desc1, effect_desc4)

                # Skip if this effect already exists in a mapped weapon
                if signature in mapped_effect_signatures:
                    continue

            # Keep this weapon
            final_weapons.append(w)

        weapons = final_weapons
        self.extracted_data = weapons

        # Display preview - show only weapons with format issues
        # Expected keys for a properly formatted weapon
        expected_keys = {
            "name", "name_jp", "name_kr", "name_zh",
            "type", "rarity", "image",
            "effect_name", "effect_name_jp", "effect_name_kr", "effect_name_zh",
            "effect_desc1", "effect_desc1_jp", "effect_desc1_kr", "effect_desc1_zh",
            "effect_desc4", "effect_desc4_jp", "effect_desc4_kr", "effect_desc4_zh",
            "effect_icon", "class", "source", "boss", "mode", "level"
        }

        problematic_weapons = []
        for w in weapons:
            weapon_keys = set(w.keys())
            missing_keys = expected_keys - weapon_keys

            # Check for missing keys or None/empty values in critical fields
            has_issues = False
            issues = []

            if missing_keys:
                has_issues = True
                issues.append(f"Missing keys: {', '.join(sorted(missing_keys))}")

            # Check for unmapped source/boss
            source = w.get("source")
            boss = w.get("boss")
            if not source or (source == "Special Request" and not boss):
                has_issues = True
                issues.append("Unmapped source/boss")

            if has_issues:
                problematic_weapons.append({
                    "weapon": w,
                    "issues": issues
                })

        preview = f"Found {len(weapons)} weapons total\n"
        preview += f"Weapons with issues: {len(problematic_weapons)}\n"
        preview += f"Weapons OK: {len(weapons) - len(problematic_weapons)}\n\n"

        if problematic_weapons:
            preview += f"{'='*60}\n"
            preview += "Weapons with format issues:\n"
            preview += f"{'='*60}\n"
            for item in problematic_weapons:
                w = item["weapon"]
                issues = item["issues"]
                preview += f"\n  - {w.get('name', 'Unknown')} ({w.get('class', '?')})\n"
                for issue in issues:
                    preview += f"    ⚠ {issue}\n"

            preview += f"\n\n{'='*60}\n"
            preview += "Full data for problematic weapons:\n"
            preview += f"{'='*60}\n"
            preview += json.dumps([item["weapon"] for item in problematic_weapons], indent=2, ensure_ascii=False)
        else:
            preview += "\n✓ All weapons are properly formatted!\n"
            preview += "\nShowing first 3 weapons as sample:\n"
            preview += json.dumps(weapons[:3], indent=2, ensure_ascii=False)

        self.content_text.setPlainText(preview)
        self.info_label.setText(f"Extracted {len(weapons)} weapons with effects")
        self.save_btn.setEnabled(True)  # Enable save button
        logger.info(f"Extracted {len(weapons)} weapons from ItemTemplet.bytes")

    def _save_weapons(self):
        """Save extracted equipment (weapons or amulets) to JSON file"""
        if not self.extracted_data:
            QMessageBox.warning(self, "Warning", "No data to save. Extract data first.")
            return

        try:
            # Determine file path based on mode
            if self.current_mode == "Weapons":
                file_path = EQUIPMENT_DATA / "weapon.json"
                item_type = "weapons"
            elif self.current_mode == "Amulets":
                file_path = EQUIPMENT_DATA / "accessory.json"
                item_type = "amulets"
            elif self.current_mode == "Sets":
                file_path = EQUIPMENT_DATA / "sets.json"
                item_type = "sets"
            elif self.current_mode == "Talisman":
                file_path = EQUIPMENT_DATA / "talisman.json"
                item_type = "talismans"
            else:
                QMessageBox.warning(self, "Warning", f"Save not implemented for {self.current_mode}")
                return

            # Confirm before saving
            reply = QMessageBox.question(
                self,
                "Confirm Save",
                f"Save {len(self.extracted_data)} {item_type} to {file_path.name}?\n\n"
                f"File: {file_path}\n\n"
                "This will overwrite the existing file!",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No
            )

            if reply == QMessageBox.StandardButton.No:
                self.info_label.setText("Save cancelled")
                return

            # Save to file
            self.info_label.setText(f"Saving {item_type}...")
            QApplication.processEvents()

            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(self.extracted_data, f, ensure_ascii=False, indent=2)

            self.info_label.setText(f"✓ Saved {len(self.extracted_data)} {item_type} to {file_path.name}")
            QMessageBox.information(
                self,
                "Save Complete",
                f"Successfully saved {len(self.extracted_data)} {item_type}!\n\n"
                f"File: {file_path}"
            )
            logger.info(f"Saved {len(self.extracted_data)} {item_type} to {file_path}")

        except Exception as e:
            logger.exception(f"Error saving {self.current_mode}")
            QMessageBox.critical(self, "Error", f"Failed to save {self.current_mode}:\n{str(e)}")
            self.info_label.setText(f"Error: {str(e)}")

    def _extract_amulets(self):
        """Extract amulets from ItemTemplet.bytes"""
        from cache_manager import CacheManager

        # Load data files
        bytes_folder = BYTES_FOLDER
        cache = CacheManager(bytes_folder)

        item_data = cache.get_data("ItemTemplet.bytes")
        special_option_data = cache.get_data("ItemSpecialOptionTemplet.bytes")
        text_skill_data = cache.get_data("TextSkill.bytes")
        buff_data = cache.get_data("BuffTemplet.bytes")
        text_item_data = cache.get_data("TextItem.bytes")
        dungeon_data = cache.get_data("DungeonTemplet.bytes")
        text_system_data = cache.get_data("TextSystem.bytes")
        reward_view_data = cache.get_data("RewardViewTemplet.bytes")

        # Load existing amulet.json to get mainStats
        existing_amulets = {}
        amulet_file = EQUIPMENT_DATA / "accessory.json"
        try:
            with open(amulet_file, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
                for a in existing_data:
                    name = a.get("name", "")
                    main_stats = a.get("mainStats", [])
                    if name and main_stats:
                        existing_amulets[name] = main_stats
            logger.info(f"Loaded mainStats for {len(existing_amulets)} amulets from existing amulet.json")
        except Exception as e:
            logger.warning(f"Could not load existing amulet.json: {e}")

        # Counter for mainStats status (will be calculated after deduplication)

        # Build indexes
        special_option_index = {}
        for opt in special_option_data:
            opt_id = opt.get("ID", "")
            if opt_id:
                special_option_index[opt_id] = opt

        text_skill_index = {}
        for text in text_skill_data:
            symbol = text.get("IDSymbol", "")
            if symbol:
                text_skill_index[symbol] = text

        text_item_index = {}
        for text in text_item_data:
            symbol = text.get("IDSymbol", "")
            if symbol:
                text_item_index[symbol] = text

        text_system_index = {}
        for text in text_system_data:
            symbol = text.get("IDSymbol", "")
            if symbol:
                text_system_index[symbol] = text

        # Build NameSymbol -> Boss name mapping
        namesymbol_to_boss = self._build_namesymbol_to_boss_mapping(dungeon_data, text_system_index)

        # Build buff index
        buff_index = {}
        for buff in buff_data:
            buff_id = buff.get("BuffID", "")
            level = buff.get("Level", "")
            if buff_id:
                key = f"{buff_id}_{level}"
                buff_index[key] = buff

        # Filter: ItemType = IT_EQUIP AND ItemSubType = ITS_EQUIP_ACCESSORY AND BasicStar >= 5
        amulets = []
        for item in item_data:
            item_type = item.get("ItemType", "")
            item_subtype = item.get("ItemSubType", "")
            basic_star = item.get("BasicStar", "")
            amulet_id = item.get("ID", "")

            # Filter: accessory type and 5+ star rarity
            if item_type != "IT_EQUIP" or item_subtype != "ITS_EQUIP_ACCESSORY":
                continue

            try:
                star_level = int(basic_star) if basic_star else 0
            except (ValueError, TypeError):
                star_level = 0

            if star_level < 5:
                continue

            # Extract amulet name from TextItem
            desc_id_symbol = item.get("DescIDSymbol", "")
            amulet_names = {}
            if desc_id_symbol and desc_id_symbol in text_item_index:
                name_text = text_item_index[desc_id_symbol]
                amulet_names["name"] = name_text.get("English", "")
                amulet_names["name_jp"] = name_text.get("Japanese", "")
                amulet_names["name_kr"] = name_text.get("Korean", "")
                amulet_names["name_zh"] = name_text.get("China_Simplified", "")

            # Map ItemGrade to rarity
            item_grade = item.get("ItemGrade", "")
            rarity_map = {
                "IG_UNIQUE": "legendary",
                "IG_RARE": "epic",
                "IG_MAGIC": "rare",
                "IG_NORMAL": "common"
            }
            rarity = rarity_map.get(item_grade, "unknown")

            # Map TrustLevelLimit to class
            trust_level = item.get("TrustLevelLimit", "")
            class_map = {
                "CCT_ATTACKER": "Striker",
                "CCT_DEFENDER": "Defender",
                "CCT_RANGER": "Ranger",
                "CCT_SUPPORTER": "Support",
                "CCT_MAGE": "Mage",
                "CCT_PRIEST": "Healer"
            }
            char_class = class_map.get(trust_level, None)

            # Get MainOptionGroupID and lookup special options
            main_option_group = item.get("MainOptionGroupID", "")
            option_ids = [x.strip() for x in str(main_option_group).split(",") if x.strip()]

            # Get special options for this amulet (UO_ACC_ prefix)
            amulet_option = None
            for opt_id in option_ids:
                if opt_id in special_option_index:
                    opt = special_option_index[opt_id]
                    name_symbol = opt.get("NameIDSymbol", "")

                    if name_symbol.startswith("UO_ACC_") or name_symbol.startswith("UO_EVENT_"):
                        amulet_option = opt
                        break

            # Extract effect data from TextSkill
            effect_data = {}
            if amulet_option:
                name_symbol = amulet_option.get("NameIDSymbol", "")
                desc_symbol = amulet_option.get("DescID", "") or amulet_option.get("CustomCraftDescIDSymbol", "")

                # Get effect name
                if name_symbol in text_skill_index:
                    name_text = text_skill_index[name_symbol]
                    effect_data["effect_name"] = name_text.get("English", "")
                    effect_data["effect_name_jp"] = name_text.get("Japanese", "")
                    effect_data["effect_name_kr"] = name_text.get("Korean", "")
                    effect_data["effect_name_zh"] = name_text.get("China_Simplified", "")

                # Get effect description
                desc_base = desc_symbol
                desc_lv1 = f"{desc_symbol}_LV1"
                desc_lv4 = f"{desc_symbol}_LV4"

                if desc_lv1 in text_skill_index:
                    desc_text_lv1 = text_skill_index[desc_lv1]
                elif desc_base in text_skill_index:
                    desc_text_lv1 = text_skill_index[desc_base]
                else:
                    desc_text_lv1 = None

                # Get buff values
                buff_id_raw = amulet_option.get("BuffID", "")
                buff_ids = [bid.strip() for bid in buff_id_raw.split(",") if bid.strip()]

                buff_lv1 = None
                buff_lv5 = None
                for buff_id in buff_ids:
                    if not buff_lv1:
                        buff_lv1 = buff_index.get(f"{buff_id}_1")
                    if not buff_lv5:
                        buff_lv5 = buff_index.get(f"{buff_id}_5")
                    if buff_lv1 and buff_lv5:
                        break

                # Replace placeholders
                def replace_placeholders(text, buff):
                    if not text or not buff:
                        return text

                    value = buff.get("Value", "")
                    applying_type = buff.get("ApplyingType", "")
                    if value and value != "OAT_NONE":
                        try:
                            val_int = int(value)
                            if applying_type == "OAT_RATE":
                                val_float = val_int / 10
                                if val_float == int(val_float):
                                    value_str = f"{int(val_float)}%"
                                else:
                                    value_str = f"{val_float}%"
                            elif val_int % 10 == 0:
                                value_str = f"{val_int // 10}%"
                            else:
                                value_str = str(val_int)
                        except:
                            value_str = str(value)

                        text = text.replace("[Value]", value_str)
                        text = text.replace("[+Value]", f"+{value_str}")
                        text = text.replace("[-Value]", value_str)

                    create_rate = buff.get("CreateRate", "")
                    if create_rate and create_rate != "OAT_NONE":
                        try:
                            rate_int = int(create_rate)
                            rate_str = f"{rate_int // 10}%"
                        except:
                            rate_str = str(create_rate)
                        text = text.replace("[Rate]", rate_str)
                        text = text.replace("[RATE]", rate_str)

                    turn_duration = buff.get("TurnDuration", "")
                    if turn_duration:
                        text = text.replace("[Turn]", str(turn_duration))

                    buff_start_cool = buff.get("BuffStartCool", "")
                    if buff_start_cool:
                        text = text.replace("[Turn2]", str(buff_start_cool))

                    return text

                if desc_text_lv1:
                    effect_data["effect_desc1"] = replace_placeholders(desc_text_lv1.get("English", ""), buff_lv1).replace(" -", " ")
                    effect_data["effect_desc1_jp"] = replace_placeholders(desc_text_lv1.get("Japanese", ""), buff_lv1).replace(" -", " ").replace("-", "")
                    effect_data["effect_desc1_kr"] = replace_placeholders(desc_text_lv1.get("Korean", ""), buff_lv1).replace(" -", " ").replace("-", "")
                    effect_data["effect_desc1_zh"] = replace_placeholders(desc_text_lv1.get("China_Simplified", ""), buff_lv1).replace("-", "")

                if desc_text_lv1 and buff_lv5:
                    effect_data["effect_desc4"] = replace_placeholders(desc_text_lv1.get("English", ""), buff_lv5).replace(" -", " ")
                    effect_data["effect_desc4_jp"] = replace_placeholders(desc_text_lv1.get("Japanese", ""), buff_lv5).replace(" -", " ").replace("-", "")
                    effect_data["effect_desc4_kr"] = replace_placeholders(desc_text_lv1.get("Korean", ""), buff_lv5).replace(" -", " ").replace("-", "")
                    effect_data["effect_desc4_zh"] = replace_placeholders(desc_text_lv1.get("China_Simplified", ""), buff_lv5).replace("-", "")

                effect_data["effect_icon"] = amulet_option.get("BuffLevel_4P", "")

            # Get item IconName
            item_icon = item.get("IconName", "")

            # Detect source type
            amulet_source_type = None

            # Manual mapping for Irregular amulets
            # Irregular amulets (Briareos 1793-1797, Gorgon 1798-1802)
            irregular_amulet_ids = ["1793", "1794", "1795", "1796", "1797", "1798", "1799", "1800", "1801", "1802"]

            if amulet_id in irregular_amulet_ids:
                amulet_source_type = "irregular"
            elif amulet_option:
                option_name_symbol = amulet_option.get("NameIDSymbol", "")
                if option_name_symbol.startswith("UO_EVENT_"):
                    amulet_source_type = "event"
                elif "LICENSE" in option_name_symbol:
                    amulet_source_type = "license"

            # Get mainStats from existing amulet.json, fallback to empty list
            amulet_name = amulet_names.get("name", "")
            if amulet_name in existing_amulets:
                main_stats = existing_amulets[amulet_name]
            else:
                # Empty mainStats for new amulets (need manual configuration)
                main_stats = []

            # Irregular amulets (Briareos and Gorgon)
            if amulet_source_type == "irregular":
                amulet_entry = {
                    **amulet_names,
                    "type": "amulet",
                    "rarity": rarity,
                    "image": item_icon,
                    **effect_data,
                    "class": char_class,
                    "mainStats": main_stats,
                    "source": "Irregular Extermination",
                    "boss": None,
                    "mode": "Infiltration Operation / Pursuit Operation",
                    "level": int(basic_star) if basic_star else None
                }
                amulets.append(amulet_entry)
            # Event amulets
            elif amulet_source_type == "event":
                amulet_entry = {
                    **amulet_names,
                    "type": "amulet",
                    "rarity": rarity,
                    "image": item_icon,
                    **effect_data,
                    "class": char_class,
                    "mainStats": main_stats,
                    "source": "Event Shop",
                    "boss": None,
                    "mode": "Event",
                    "level": int(basic_star) if basic_star else None
                }
                amulets.append(amulet_entry)
            # License amulets
            elif amulet_source_type == "license":
                amulet_entry = {
                    **amulet_names,
                    "type": "amulet",
                    "rarity": rarity,
                    "image": item_icon,
                    **effect_data,
                    "class": char_class,
                    "mainStats": main_stats,
                    "source": "Adventure License",
                    "boss": None,
                    "mode": "License Shop",
                    "level": int(basic_star) if basic_star else None
                }
                amulets.append(amulet_entry)
            else:
                # Special Request amulets
                amulet_namesymbols = set()
                for rv in reward_view_data:
                    icon = rv.get("Icon", "")
                    if icon == "TI_Equipment_Accessary_06":  # Note: typo in game
                        min_id = rv.get("MinItemID", "")
                        max_id = rv.get("MaxItemID", "")
                        name_symbol = rv.get("NameSymbol", "")

                        if name_symbol in namesymbol_to_boss and min_id and max_id:
                            try:
                                amulet_id_int = int(amulet_id)
                                min_id_int = int(min_id)
                                max_id_int = int(max_id)

                                if min_id_int <= amulet_id_int <= max_id_int:
                                    amulet_namesymbols.add(name_symbol)
                            except (ValueError, TypeError):
                                pass

                if amulet_namesymbols:
                    for name_symbol in amulet_namesymbols:
                        boss_info = namesymbol_to_boss[name_symbol]
                        boss = boss_info["boss"]

                        amulet_entry = {
                            **amulet_names,
                            "type": "amulet",
                            "rarity": rarity,
                            "image": item_icon,
                            **effect_data,
                            "class": char_class,
                            "mainStats": main_stats,
                            "source": "Special Request",
                            "boss": boss,
                            "mode": None,
                            "level": int(basic_star) if basic_star else None
                        }
                        amulets.append(amulet_entry)
                else:
                    # Unmapped
                    amulet_entry = {
                        **amulet_names,
                        "type": "amulet",
                        "rarity": rarity,
                        "image": item_icon,
                        **effect_data,
                        "class": char_class,
                        "mainStats": main_stats,
                        "source": None,
                        "boss": None,
                        "mode": None,
                        "level": int(basic_star) if basic_star else None
                    }
                    amulets.append(amulet_entry)

        # Post-processing filters
        excluded_names = ["Steel Necklace", "Fine Necklace", "Ordinary Necklace", "Ether Amulet", "Hunter Amulet Ver. 2.0", "Hunter Amulet Ver. 1.0"]
        amulets = [a for a in amulets if a.get("name", "").split("[")[0].strip() not in excluded_names]

        # Group by base name and keep only 6-star if both 5 and 6 exist
        amulets_by_base_name = {}
        for a in amulets:
            full_name = a.get("name", "")
            base_name = full_name.split("[")[0].strip() if "[" in full_name else full_name

            if base_name not in amulets_by_base_name:
                amulets_by_base_name[base_name] = []
            amulets_by_base_name[base_name].append(a)

        filtered_amulets = []
        for base_name, amulet_list in amulets_by_base_name.items():
            has_6_star = any(a.get("level") == 6 for a in amulet_list)

            if has_6_star:
                filtered_amulets.extend([a for a in amulet_list if a.get("level") == 6])
            else:
                filtered_amulets.extend(amulet_list)

        amulets = filtered_amulets

        # Remove unmapped amulets with duplicate effects
        mapped_effect_signatures = set()
        for a in amulets:
            source = a.get("source")
            if source:
                effect_desc1 = a.get("effect_desc1", "")
                effect_desc4 = a.get("effect_desc4", "")
                signature = (effect_desc1, effect_desc4)
                mapped_effect_signatures.add(signature)

        final_amulets = []
        for a in amulets:
            source = a.get("source")
            boss = a.get("boss")
            mode = a.get("mode")

            if not source and not boss and not mode:
                effect_desc1 = a.get("effect_desc1", "")
                effect_desc4 = a.get("effect_desc4", "")
                signature = (effect_desc1, effect_desc4)

                if signature in mapped_effect_signatures:
                    continue

            final_amulets.append(a)

        amulets = final_amulets

        # Remove duplicates based on (name, effect_name, effect_desc1)
        seen_amulets = {}
        unique_amulets = []
        for a in amulets:
            name = a.get("name", "")
            effect_name = a.get("effect_name", "")
            effect_desc1 = a.get("effect_desc1", "")
            signature = (name, effect_name, effect_desc1)

            if signature not in seen_amulets:
                seen_amulets[signature] = a
                unique_amulets.append(a)

        amulets = unique_amulets
        self.extracted_data = amulets

        # Calculate mainStats recovery report after deduplication
        recovered_mainstats_count = 0
        empty_mainstats_count = 0
        for a in amulets:
            main_stats = a.get("mainStats", [])
            if main_stats:
                recovered_mainstats_count += 1
            else:
                empty_mainstats_count += 1

        # Log mainStats recovery report
        logger.info(f"MainStats recovery report:")
        logger.info(f"  - Recovered from existing amulet.json: {recovered_mainstats_count}")
        logger.info(f"  - Empty mainStats (need manual config): {empty_mainstats_count}")
        logger.info(f"  - Total amulets: {len(amulets)}")

        # Display preview
        expected_keys = {
            "name", "name_jp", "name_kr", "name_zh",
            "type", "rarity", "image",
            "effect_name", "effect_name_jp", "effect_name_kr", "effect_name_zh",
            "effect_desc1", "effect_desc1_jp", "effect_desc1_kr", "effect_desc1_zh",
            "effect_desc4", "effect_desc4_jp", "effect_desc4_kr", "effect_desc4_zh",
            "effect_icon", "class", "mainStats", "source", "boss", "mode", "level"
        }

        problematic_amulets = []
        for a in amulets:
            amulet_keys = set(a.keys())
            missing_keys = expected_keys - amulet_keys

            has_issues = False
            issues = []

            if missing_keys:
                has_issues = True
                issues.append(f"Missing keys: {', '.join(sorted(missing_keys))}")

            source = a.get("source")
            boss = a.get("boss")
            if not source or (source == "Special Request" and not boss):
                has_issues = True
                issues.append("Unmapped source/boss")

            if has_issues:
                problematic_amulets.append({
                    "amulet": a,
                    "issues": issues
                })

        preview = f"Found {len(amulets)} amulets total\n"
        preview += f"Amulets with issues: {len(problematic_amulets)}\n"
        preview += f"Amulets OK: {len(amulets) - len(problematic_amulets)}\n\n"

        if problematic_amulets:
            preview += f"{'='*60}\n"
            preview += "Amulets with format issues:\n"
            preview += f"{'='*60}\n"
            for item in problematic_amulets:
                a = item["amulet"]
                issues = item["issues"]
                preview += f"\n  - {a.get('name', 'Unknown')} ({a.get('class', '?')})\n"
                for issue in issues:
                    preview += f"    ⚠ {issue}\n"

            preview += f"\n\n{'='*60}\n"
            preview += "Full data for problematic amulets:\n"
            preview += f"{'='*60}\n"
            preview += json.dumps([item["amulet"] for item in problematic_amulets], indent=2, ensure_ascii=False)
        else:
            preview += "\n✓ All amulets are properly formatted!\n"
            preview += "\nShowing first 3 amulets as sample:\n"
            preview += json.dumps(amulets[:3], indent=2, ensure_ascii=False)

        self.content_text.setPlainText(preview)
        self.info_label.setText(f"Extracted {len(amulets)} amulets with effects")
        self.save_btn.setEnabled(True)
        logger.info(f"Extracted {len(amulets)} amulets from ItemTemplet.bytes")

    def _extract_sets(self):
        """Extract equipment sets from ItemSpecialOptionTemplet.bytes"""
        from cache_manager import CacheManager

        # Load data files
        bytes_folder = BYTES_FOLDER
        cache = CacheManager(bytes_folder)

        special_option_data = cache.get_data("ItemSpecialOptionTemplet.bytes")
        text_item_data = cache.get_data("TextItem.bytes")
        text_skill_data = cache.get_data("TextSkill.bytes")
        dungeon_data = cache.get_data("DungeonTemplet.bytes")
        text_system_data = cache.get_data("TextSystem.bytes")
        reward_view_data = cache.get_data("RewardViewTemplet.bytes")

        # Build indexes
        text_item_index = {}
        for text in text_item_data:
            symbol = text.get("IDSymbol", "")
            if symbol:
                text_item_index[symbol] = text

        text_skill_index = {}
        for text in text_skill_data:
            symbol = text.get("IDSymbol", "")
            if symbol:
                text_skill_index[symbol] = text

        text_system_index = {}
        for text in text_system_data:
            symbol = text.get("IDSymbol", "")
            if symbol:
                text_system_index[symbol] = text

        # Build set GroupID -> Boss mapping (using RAID_1)
        set_groupid_to_boss = self._build_set_groupid_to_boss_mapping(
            reward_view_data, dungeon_data, text_system_index
        )

        # Find set options (filter by ST_Set_ in NameIDSymbol)
        set_options = [opt for opt in special_option_data if 'ST_Set_' in opt.get('NameIDSymbol', '')]

        # Group by GroupID
        from collections import defaultdict
        sets_by_group = defaultdict(list)
        for opt in set_options:
            group_id = opt.get('GroupID', '')
            sets_by_group[group_id].append(opt)

        # Extract sets
        sets = []
        for group_id in sorted(sets_by_group.keys(), key=lambda x: int(x) if x.isdigit() else 0):
            levels = sets_by_group[group_id]
            lv1 = next((l for l in levels if l.get('Level') == '1'), None)
            lv2 = next((l for l in levels if l.get('Level') == '2'), None)

            if not lv1:
                continue

            # Extract set name from TextItem
            name_symbol = lv1.get('NameIDSymbol', '')
            set_names = {}
            if name_symbol and name_symbol in text_item_index:
                name_text = text_item_index[name_symbol]
                set_names["name"] = name_text.get("English", "")
                set_names["name_jp"] = name_text.get("Japanese", "")
                set_names["name_kr"] = name_text.get("Korean", "")
                set_names["name_zh"] = name_text.get("China_Simplified", "")

            # Get set icon (stored in BuffLevel_4P)
            set_icon = lv1.get("BuffLevel_4P", "")

            # Helper functions for effect extraction
            def format_stat_effect(stat_type, applying_type, value):
                """Format stat-based effect with translations"""
                if not value or value == "0" or stat_type == "ST_NONE" or value == "OAT_NONE":
                    return None

                # Map ST_ stat types to SYS_STAT_ keys
                stat_to_sys_map = {
                    "ST_ATK": "SYS_STAT_ATK",
                    "ST_DEF": "SYS_STAT_DEF",
                    "ST_HP": "SYS_STAT_HP",
                    "ST_CRITICAL_RATE": "SYS_STAT_CRITICAL_RATE",
                    "ST_BUFF_CHANCE": "SYS_STAT_BUFF_CHANCE",
                    "ST_BUFF_RESIST": "SYS_STAT_BUFF_RESIST",
                    "ST_COUNTER_RATE": "SYS_STAT_COUNTER_RATE",
                    "ST_ACCURACY": "SYS_STAT_ACCURACY",
                    "ST_AVOID": "SYS_STAT_AVOID",
                    "ST_VAMPIRIC": "SYS_STAT_VAMPIRIC",
                    "ST_CRITICAL_DMG_RATE": "SYS_STAT_CRITICAL_DMG_RATE",
                    "ST_SPEED": "SYS_STAT_SPEED",
                    "ST_PIERCE_POWER_RATE": "SYS_STAT_PIERCE_POWER_RATE",
                    "ST_ENTER_AP": "SYS_STAT_ENTER_AP"
                }

                # Stats that are always percentages (even when ApplyingType is OAT_ADD)
                always_percentage_stats = {
                    "ST_CRITICAL_RATE", "ST_BUFF_CHANCE", "ST_BUFF_RESIST",
                    "ST_COUNTER_RATE", "ST_ACCURACY", "ST_AVOID", "ST_VAMPIRIC", "ST_CRITICAL_DMG_RATE",
                    "ST_PIERCE_POWER_RATE"
                }

                sys_stat_key = stat_to_sys_map.get(stat_type, stat_type)

                # Format the value
                try:
                    val_int = int(value)
                    # Check if it should be a percentage (either OAT_RATE or inherently percentage stat)
                    if applying_type == "OAT_RATE" or stat_type in always_percentage_stats:
                        val_float = val_int / 10
                        # Remove .0 for integers
                        if val_float == int(val_float):
                            formatted_value = f"+{int(val_float)}%"
                        else:
                            formatted_value = f"+{val_float}%"
                    else:
                        formatted_value = f"+{val_int}"
                except (ValueError, TypeError):
                    formatted_value = f"+{value}"

                # Get translations from TextSystem
                if sys_stat_key in text_system_index:
                    sys_text = text_system_index[sys_stat_key]
                    return {
                        "en": f"{sys_text.get('English', stat_type)} {formatted_value}",
                        "jp": f"{sys_text.get('Japanese', stat_type)} {formatted_value}",
                        "kr": f"{sys_text.get('Korean', stat_type)} {formatted_value}",
                        "zh": f"{sys_text.get('China_Simplified', stat_type)} {formatted_value}"
                    }
                else:
                    # Fallback for stats not in TextSystem
                    return {
                        "en": f"{sys_stat_key} {formatted_value}",
                        "jp": None,
                        "kr": None,
                        "zh": None
                    }

            def extract_effect(level_data, piece_type):
                """Extract effect for 2P or 4P"""
                option_type = level_data.get(f"OptionType_{piece_type}", "")

                if option_type == "IOT_STAT":
                    # Stats-based effect
                    stat_type = level_data.get(f"StatType_{piece_type}", "")
                    applying_type = level_data.get(f"ApplyingType_{piece_type}", "")
                    if piece_type == "2P":
                        value = level_data.get("BuffLevel_2P", "")
                    else:  # 4P
                        # Try both possible field names for 4P value
                        value = level_data.get("OptionType_4P_fallback1", "") or level_data.get("BuffLevel_2P_fallback1", "")
                    return format_stat_effect(stat_type, applying_type, value)

                elif option_type == "IOT_BUFF":
                    # Buff-based effect - get description from DescID
                    desc_id = level_data.get("DescID", "")
                    desc_ids = [d.strip() for d in desc_id.split(",") if d.strip()]

                    if piece_type == "2P" and len(desc_ids) > 0:
                        desc_symbol = desc_ids[0]
                    elif piece_type == "4P" and len(desc_ids) > 1:
                        desc_symbol = desc_ids[1]
                    elif piece_type == "4P" and len(desc_ids) == 1:
                        desc_symbol = desc_ids[0]
                    else:
                        return None

                    # Look up in TextSkill
                    if desc_symbol in text_skill_index:
                        text_entry = text_skill_index[desc_symbol]
                        return {
                            "en": text_entry.get("English", ""),
                            "jp": text_entry.get("Japanese", ""),
                            "kr": text_entry.get("Korean", ""),
                            "zh": text_entry.get("China_Simplified", "")
                        }

                return None

            # Extract effects
            effect_2_1 = extract_effect(lv1, "2P")
            effect_4_1 = extract_effect(lv1, "4P")
            effect_2_4 = extract_effect(lv2, "2P") if lv2 else effect_2_1
            effect_4_4 = extract_effect(lv2, "4P") if lv2 else effect_4_1

            # Get source/boss from mapping
            boss_info = set_groupid_to_boss.get(group_id, {})
            source = "Special Request" if boss_info else None
            boss = boss_info.get("boss") if boss_info else None
            mode = None  # Sets don't have a mode

            # Helper function to extract effect translations
            def get_effect_values(effect_val):
                if isinstance(effect_val, dict):
                    return {
                        "en": effect_val.get("en"),
                        "jp": effect_val.get("jp"),
                        "kr": effect_val.get("kr"),
                        "zh": effect_val.get("zh")
                    }
                elif isinstance(effect_val, str):
                    return {"en": effect_val, "jp": None, "kr": None, "zh": None}
                else:
                    return {"en": None, "jp": None, "kr": None, "zh": None}

            # Extract effect values
            effect_2_1_vals = get_effect_values(effect_2_1)
            effect_4_1_vals = get_effect_values(effect_4_1)
            effect_2_4_vals = get_effect_values(effect_2_4)
            effect_4_4_vals = get_effect_values(effect_4_4)

            # Build set entry with explicit key order: name (+ translations), rarity, set_icon,
            # effect_2_1 (+ jp/kr/zh), effect_4_1 (+ jp/kr/zh), effect_2_4 (+ jp/kr/zh),
            # effect_4_4 (+ jp/kr/zh), class, source, boss, mode, image_prefix
            set_entry = {
                "name": set_names.get("name"),
                "name_jp": set_names.get("name_jp"),
                "name_kr": set_names.get("name_kr"),
                "name_zh": set_names.get("name_zh"),
                "rarity": "legendary",
                "set_icon": set_icon,
                "effect_2_1": effect_2_1_vals["en"],
                "effect_2_1_jp": effect_2_1_vals["jp"],
                "effect_2_1_kr": effect_2_1_vals["kr"],
                "effect_2_1_zh": effect_2_1_vals["zh"],
                "effect_4_1": effect_4_1_vals["en"],
                "effect_4_1_jp": effect_4_1_vals["jp"],
                "effect_4_1_kr": effect_4_1_vals["kr"],
                "effect_4_1_zh": effect_4_1_vals["zh"],
                "effect_2_4": effect_2_4_vals["en"],
                "effect_2_4_jp": effect_2_4_vals["jp"],
                "effect_2_4_kr": effect_2_4_vals["kr"],
                "effect_2_4_zh": effect_2_4_vals["zh"],
                "effect_4_4": effect_4_4_vals["en"],
                "effect_4_4_jp": effect_4_4_vals["jp"],
                "effect_4_4_kr": effect_4_4_vals["kr"],
                "effect_4_4_zh": effect_4_4_vals["zh"],
                "class": None,
                "source": source,
                "boss": boss,
                "mode": mode,
                "image_prefix": "06"
            }

            sets.append(set_entry)

        # Store extracted data
        self.extracted_data = sets

        # Validation: Check for missing or incomplete data
        problematic_sets = []
        for s in sets:
            has_issues = False
            issues = []

            # Check mandatory fields
            if not s.get("name"):
                has_issues = True
                issues.append("Missing name")

            if not s.get("set_icon"):
                has_issues = True
                issues.append("Missing set_icon")

            # Check that at least ONE effect exists (not all sets have all effects)
            has_any_effect = any([
                s.get("effect_2_1"),
                s.get("effect_4_1"),
                s.get("effect_2_4"),
                s.get("effect_4_4")
            ])

            if not has_any_effect:
                has_issues = True
                issues.append("No effects found")

            if has_issues:
                problematic_sets.append({
                    "set": s,
                    "issues": issues
                })

        preview = f"Found {len(sets)} equipment sets total\n"
        preview += f"Sets with issues: {len(problematic_sets)}\n"
        preview += f"Sets OK: {len(sets) - len(problematic_sets)}\n\n"

        if problematic_sets:
            preview += f"{'='*60}\n"
            preview += "Sets with format issues:\n"
            preview += f"{'='*60}\n"
            for item in problematic_sets:
                s = item["set"]
                issues = item["issues"]
                preview += f"\n  - {s.get('name', 'Unknown')}\n"
                for issue in issues:
                    preview += f"    ⚠ {issue}\n"

            preview += f"\n\n{'='*60}\n"
            preview += "Full data for problematic sets:\n"
            preview += f"{'='*60}\n"
            preview += json.dumps([item["set"] for item in problematic_sets], indent=2, ensure_ascii=False)
        else:
            preview += "\n✓ All sets are properly formatted!\n"
            preview += "\nShowing all sets:\n"
            preview += json.dumps(sets, indent=2, ensure_ascii=False)

        self.content_text.setPlainText(preview)
        self.info_label.setText(f"Extracted {len(sets)} equipment sets")
        self.save_btn.setEnabled(True)
        logger.info(f"Extracted {len(sets)} sets from ItemSpecialOptionTemplet.bytes")

    def _extract_talismans(self):
        """Extract talismans (OOPARTS) from ItemTemplet.bytes"""
        logger.info("Starting talisman extraction...")

        # Initialize cache
        from cache_manager import CacheManager

        bytes_folder = BYTES_FOLDER
        cache = CacheManager(bytes_folder)

        # Load required data files
        item_data = cache.get_data("ItemTemplet.bytes")
        special_option_data = cache.get_data("ItemSpecialOptionTemplet.bytes")
        buff_data = cache.get_data("BuffTemplet.bytes")
        text_item_data = cache.get_data("TextItem.bytes")
        text_skill_data = cache.get_data("TextSkill.bytes")

        # Build indexes
        text_item_index = {t.get("IDSymbol", ""): t for t in text_item_data if t.get("IDSymbol")}
        text_skill_index = {t.get("IDSymbol", ""): t for t in text_skill_data if t.get("IDSymbol")}
        special_option_index = {o.get("ID", ""): o for o in special_option_data if o.get("ID")}

        # Helper function to find buff by BuffID and Level
        def find_buff(buff_id, level):
            """Find buff entry matching both BuffID and Level"""
            for b in buff_data:
                if b.get("BuffID") == buff_id and b.get("Level") == str(level):
                    return b
            # Fallback: return any buff with this ID if no level match
            for b in buff_data:
                if b.get("BuffID") == buff_id:
                    return b
            return None

        # Filter talismans: 6-star unique OOPARTS
        talismans = [
            item for item in item_data
            if item.get("ItemType") == "IT_EQUIP"
            and item.get("ItemSubType") == "ITS_EQUIP_OOPARTS"
            and item.get("ItemGrade") == "IG_UNIQUE"
            and item.get("BasicStar") == "6"
        ]

        logger.info(f"Found {len(talismans)} talismans to extract")

        def replace_value_placeholder(text, value, rate=None):
            """Replace [Value] and [Rate] placeholders with actual values"""
            if not text:
                return None
            result = text.replace("[Value]", str(value))
            if rate is not None:
                # Convert rate (e.g., 1000 → 100%)
                rate_percent = int(rate) // 10
                result = result.replace("[Rate]", f"{rate_percent}%")
            return result

        # Extract talismans
        extracted_talismans = []

        for t in talismans:
            talisman_id = t.get("ID", "")
            desc_sym = t.get("DescIDSymbol", "")
            icon = t.get("IconName", "")
            enchant_cost_rate = t.get("ItemEnchantCostRate", "")

            # Get effect number from ItemSpecialOptionTemplet using ItemEnchantCostRate
            effect_num = None
            if enchant_cost_rate:
                rate_ids = [r.strip() for r in enchant_cost_rate.split(",")]
                if len(rate_ids) >= 1:
                    lv1_id = rate_ids[0]
                    lv1_option = special_option_index.get(lv1_id)
                    if lv1_option:
                        # Extract effect number from NameIDSymbol (e.g., UO_OOPARTS_08_NAME -> 08)
                        name_id_symbol = lv1_option.get("NameIDSymbol", "")
                        if name_id_symbol.startswith("UO_OOPARTS_") and "_NAME" in name_id_symbol:
                            effect_num = name_id_symbol.replace("UO_OOPARTS_", "").replace("_NAME", "")

            if not effect_num:
                logger.warning(f"Could not determine effect number for talisman ID {talisman_id}, skipping")
                continue

            # Get name translations
            name_en = text_item_index.get(desc_sym, {}).get("English", "")
            name_jp = text_item_index.get(desc_sym, {}).get("Japanese", "")
            name_kr = text_item_index.get(desc_sym, {}).get("Korean", "")
            name_zh = text_item_index.get(desc_sym, {}).get("China_Simplified", "")

            # Get effect name translations
            effect_name_sym = f"UO_OOPARTS_{effect_num}_NAME"
            effect_name_en = text_skill_index.get(effect_name_sym, {}).get("English", "")
            effect_name_jp = text_skill_index.get(effect_name_sym, {}).get("Japanese", "")
            effect_name_kr = text_skill_index.get(effect_name_sym, {}).get("Korean", "")
            effect_name_zh = text_skill_index.get(effect_name_sym, {}).get("China_Simplified", "")

            # Determine type based on effect name (CP if Chain Point, AP if Action Point)
            talisman_type = None
            if effect_name_en:
                if "Chain Point" in effect_name_en:
                    talisman_type = "CP"
                elif "Action Point" in effect_name_en:
                    talisman_type = "AP"

            # Get effect icon and descriptions from ItemSpecialOptionTemplet using ItemEnchantCostRate
            effect_icon = None
            effect_desc1_en = None
            effect_desc1_jp = None
            effect_desc1_kr = None
            effect_desc1_zh = None
            effect_desc4_en = None
            effect_desc4_jp = None
            effect_desc4_kr = None
            effect_desc4_zh = None

            if enchant_cost_rate:
                rate_ids = [r.strip() for r in enchant_cost_rate.split(",")]

                # Level 1 data
                if len(rate_ids) >= 1:
                    lv1_id = rate_ids[0]
                    lv1_option = special_option_index.get(lv1_id)

                    if lv1_option:
                        # Get effect icon
                        effect_icon = lv1_option.get("BuffLevel_4P", "")

                        # Get description symbol and buff ID
                        desc1_sym = lv1_option.get("CustomCraftDescIDSymbol", "")
                        buff1_id = lv1_option.get("BuffID", "")
                        lv1_level = lv1_option.get("Level", "1")

                        # Split BuffID if it contains comma (e.g., Saint's Charm)
                        if buff1_id and "," in buff1_id:
                            buff1_id = buff1_id.split(",")[0].strip()

                        # Get value and CreateRate from buff (matching BuffID and Level)
                        value1 = ""
                        rate1 = None
                        if buff1_id and buff1_id != "OAT_NONE":
                            buff1 = find_buff(buff1_id, lv1_level)
                            if buff1:
                                value1 = buff1.get("Value", "")
                                rate1 = buff1.get("CreateRate")  # For [Rate] placeholder

                        # Get description text with value and rate replaced
                        if desc1_sym in text_skill_index:
                            desc1_text = text_skill_index[desc1_sym]
                            effect_desc1_en = replace_value_placeholder(desc1_text.get("English", ""), value1, rate1)
                            effect_desc1_jp = replace_value_placeholder(desc1_text.get("Japanese", ""), value1, rate1)
                            effect_desc1_kr = replace_value_placeholder(desc1_text.get("Korean", ""), value1, rate1)
                            effect_desc1_zh = replace_value_placeholder(desc1_text.get("China_Simplified", ""), value1, rate1)

                # Level 10 data
                if len(rate_ids) >= 2:
                    lv10_id = rate_ids[1]
                    lv10_option = special_option_index.get(lv10_id)

                    if lv10_option:
                        # Get description symbol and buff ID
                        desc10_sym = lv10_option.get("CustomCraftDescIDSymbol", "")
                        buff10_id = lv10_option.get("BuffID", "")
                        lv10_level = lv10_option.get("Level", "10")

                        # Check if BuffID is OAT_NONE (no level 10 effect for Adventurer's Talismans)
                        if buff10_id == "OAT_NONE" or not buff10_id:
                            # No level 10 effect - leave descriptions as None
                            pass
                        else:
                            # Split BuffID if it contains comma
                            if "," in buff10_id:
                                buff10_id = buff10_id.split(",")[0].strip()

                            # Get value and CreateRate from buff (matching BuffID and Level)
                            value10 = ""
                            rate10 = None
                            buff10 = find_buff(buff10_id, lv10_level)
                            if buff10:
                                value10 = buff10.get("Value", "")
                                rate10 = buff10.get("CreateRate")  # For [Rate] placeholder

                            # Get description text with value and rate replaced
                            if desc10_sym in text_skill_index:
                                desc10_text = text_skill_index[desc10_sym]
                                effect_desc4_en = replace_value_placeholder(desc10_text.get("English", ""), value10, rate10)
                                effect_desc4_jp = replace_value_placeholder(desc10_text.get("Japanese", ""), value10, rate10)
                                effect_desc4_kr = replace_value_placeholder(desc10_text.get("Korean", ""), value10, rate10)
                                effect_desc4_zh = replace_value_placeholder(desc10_text.get("China_Simplified", ""), value10, rate10)

            # Keep the full icon name with TI_Equipment_ prefix
            icon_name = icon if icon else ""

            # Build talisman entry with exact key order specified by user:
            # name (+ translations), type, rarity, image, effect_name (+ translations),
            # effect_desc1 (+ jp/kr/zh), effect_desc4 (+ jp/kr/zh), effect_icon, level, source, boss, mode
            talisman_entry = {
                "name": name_en,
                "name_jp": name_jp,
                "name_kr": name_kr,
                "name_zh": name_zh,
                "type": talisman_type,
                "rarity": "legendary",
                "image": icon_name,
                "effect_name": effect_name_en,
                "effect_name_jp": effect_name_jp,
                "effect_name_kr": effect_name_kr,
                "effect_name_zh": effect_name_zh,
                "effect_desc1": effect_desc1_en,
                "effect_desc1_jp": effect_desc1_jp,
                "effect_desc1_kr": effect_desc1_kr,
                "effect_desc1_zh": effect_desc1_zh,
                "effect_desc4": effect_desc4_en,
                "effect_desc4_jp": effect_desc4_jp,
                "effect_desc4_kr": effect_desc4_kr,
                "effect_desc4_zh": effect_desc4_zh,
                "effect_icon": effect_icon,
                "level": "6",
                "source": None,
                "boss": None,
                "mode": None
            }

            extracted_talismans.append(talisman_entry)

        # Store extracted data
        self.extracted_data = extracted_talismans

        # Validation: Check for missing or incomplete data
        problematic_talismans = []
        for tal in extracted_talismans:
            has_issues = False
            issues = []

            # Check mandatory fields
            if not tal.get("name"):
                has_issues = True
                issues.append("missing name")

            if not tal.get("effect_name"):
                has_issues = True
                issues.append("missing effect_name")

            if not tal.get("effect_desc1") and not tal.get("effect_desc4"):
                has_issues = True
                issues.append("missing both effect descriptions")

            if not tal.get("type"):
                has_issues = True
                issues.append("missing type (CP/AP)")

            if has_issues:
                problematic_talismans.append({"talisman": tal, "issues": issues})

        # Build preview
        preview = f"Extracted {len(extracted_talismans)} talismans\n"
        preview += "="*60 + "\n\n"

        if problematic_talismans:
            preview += f"⚠ WARNING: Found {len(problematic_talismans)} talismans with issues:\n\n"
            for item in problematic_talismans:
                preview += f"- {item['talisman'].get('name', 'UNNAMED')}: {', '.join(item['issues'])}\n"

            preview += f"\n\n{'='*60}\n"
            preview += "Full data for problematic talismans:\n"
            preview += f"{'='*60}\n"
            preview += json.dumps([item["talisman"] for item in problematic_talismans], indent=2, ensure_ascii=False)
        else:
            preview += "✓ All talismans are properly formatted!\n"
            preview += "\nShowing all talismans:\n"
            preview += json.dumps(extracted_talismans, indent=2, ensure_ascii=False)

        self.content_text.setPlainText(preview)
        self.info_label.setText(f"Extracted {len(extracted_talismans)} talismans")
        self.save_btn.setEnabled(True)
        logger.info(f"Extracted {len(extracted_talismans)} talismans from ItemTemplet.bytes")


class ParserV3MainWindow(QMainWindow):
    """Main application window for ParserV3 PyQt6 edition"""

    def __init__(self):
        super().__init__()
        self.setWindowTitle("ParserV3 - OUTERPLANE Character Extractor (PyQt6)")
        self.setGeometry(100, 100, 1400, 900)

        # Set window icon
        icon_path = PUBLIC_IMAGES / "logo.png"
        if icon_path.exists():
            self.setWindowIcon(QIcon(str(icon_path)))
        else:
            logger.warning(f"Logo icon not found at: {icon_path}")

        self._setup_ui()
        self._setup_menu()

        logger.info("ParserV3 PyQt6 GUI started")

    def _setup_ui(self):
        """Setup main UI"""
        # Central widget
        central_widget = QWidget()
        self.setCentralWidget(central_widget)

        # Main layout
        layout = QVBoxLayout(central_widget)

        # Tab widget
        self.tabs = QTabWidget()

        # Create tabs
        try:
            self.character_tab = CharacterTab()
        except FileNotFoundError as e:
            # Show error and offer to extract assets
            QMessageBox.critical(
                self,
                "Missing Game Files",
                f"{str(e)}\n\n"
                "The GUI will continue loading, but Character extraction features will be unavailable.\n"
                "Use Tools -> Rip Assets to extract game files first."
            )
            # Create empty tab placeholder
            self.character_tab = QWidget()
            placeholder_layout = QVBoxLayout(self.character_tab)
            placeholder_label = QLabel(
                "<h2>Character Extraction Unavailable</h2>"
                "<p>Game files are missing. Please use <b>Tools -> Rip Assets</b> to extract them first.</p>"
            )
            placeholder_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
            placeholder_layout.addWidget(placeholder_label)

        self.binary_tab = BinaryExplorerTab()
        self.boss_tab = BossTabV2()
        self.buff_validator_tab = BuffValidatorTab()
        self.localization_tab = LocalizationTab()
        self.equipment_tab = EquipmentTab()
        self.geas_tab = GeasTab()
        self.core_fusion_tab = CoreFusionTab()

        # Add tabs
        self.tabs.addTab(self.character_tab, "Character")
        self.tabs.addTab(self.core_fusion_tab, "Core Fusion")
        self.tabs.addTab(self.localization_tab, "Localization")
        self.tabs.addTab(self.equipment_tab, "Equipment")
        self.tabs.addTab(self.geas_tab, "Geas")
        self.tabs.addTab(self.boss_tab, "Boss")
        self.tabs.addTab(self.buff_validator_tab, "Buff Validator")
        self.tabs.addTab(self.binary_tab, "Binary Explorer")

        layout.addWidget(self.tabs)

        # Status bar
        self.statusBar().showMessage("Ready")

    def _setup_menu(self):
        """Setup menu bar"""
        menubar = self.menuBar()

        # File menu
        file_menu = menubar.addMenu("&File")

        exit_action = QAction("E&xit", self)
        exit_action.setShortcut("Ctrl+Q")
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)

        # View menu
        view_menu = menubar.addMenu("&View")

        reload_action = QAction("&Reload GUI", self)
        reload_action.setShortcut("F5")
        reload_action.triggered.connect(self._reload_gui)
        view_menu.addAction(reload_action)

        view_menu.addSeparator()

        self.always_on_top_action = QAction("Always on &Top", self)
        self.always_on_top_action.setCheckable(True)
        self.always_on_top_action.setChecked(False)
        self.always_on_top_action.triggered.connect(self._toggle_always_on_top)
        view_menu.addAction(self.always_on_top_action)

        # Tools menu
        tools_menu = menubar.addMenu("&Tools")

        rip_assets_action = QAction("&Rip Assets", self)
        rip_assets_action.triggered.connect(self._rip_assets)
        tools_menu.addAction(rip_assets_action)

        bgm_extract_action = QAction("&BGM Extract", self)
        bgm_extract_action.triggered.connect(self._extract_bgm)
        tools_menu.addAction(bgm_extract_action)

        # Help menu
        help_menu = menubar.addMenu("&Help")

        about_action = QAction("&About", self)
        about_action.triggered.connect(self._show_about)
        help_menu.addAction(about_action)

    def _reload_gui(self):
        """Reload the GUI - recreate all tabs"""
        try:
            logger.info("Reloading GUI...")

            # Save current tab index
            current_tab = self.tabs.currentIndex()

            # Clear all tabs
            self.tabs.clear()

            # Recreate tabs
            try:
                self.character_tab = CharacterTab()
            except FileNotFoundError as e:
                # Create placeholder
                self.character_tab = QWidget()
                placeholder_layout = QVBoxLayout(self.character_tab)
                placeholder_label = QLabel(
                    "<h2>Character Extraction Unavailable</h2>"
                    "<p>Game files are missing. Please use <b>Tools -> Rip Assets</b> to extract them first.</p>"
                )
                placeholder_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
                placeholder_layout.addWidget(placeholder_label)

            self.binary_tab = BinaryExplorerTab()
            self.boss_tab = BossTabV2()
            self.buff_validator_tab = BuffValidatorTab()
            self.localization_tab = LocalizationTab()
            self.equipment_tab = EquipmentTab()
            self.geas_tab = GeasTab()

            # Re-add tabs
            self.tabs.addTab(self.character_tab, "Character")
            self.tabs.addTab(self.localization_tab, "Localization")
            self.tabs.addTab(self.equipment_tab, "Equipment")
            self.tabs.addTab(self.geas_tab, "Geas")
            self.tabs.addTab(self.boss_tab, "Boss")
            self.tabs.addTab(self.buff_validator_tab, "Buff Validator")
            self.tabs.addTab(self.binary_tab, "Binary Explorer")

            # Restore tab selection
            if current_tab < self.tabs.count():
                self.tabs.setCurrentIndex(current_tab)

            self.statusBar().showMessage("GUI reloaded successfully", 3000)
            logger.info("GUI reloaded successfully")

        except Exception as e:
            logger.exception("Error reloading GUI")
            QMessageBox.critical(self, "Reload Error", f"Failed to reload GUI:\n{str(e)}")

    def _toggle_always_on_top(self):
        """Toggle the Always on Top window flag"""
        if self.always_on_top_action.isChecked():
            # Enable always on top
            self.setWindowFlags(self.windowFlags() | Qt.WindowType.WindowStaysOnTopHint)
            logger.info("Always on Top enabled")
        else:
            # Disable always on top
            self.setWindowFlags(self.windowFlags() & ~Qt.WindowType.WindowStaysOnTopHint)
            logger.info("Always on Top disabled")

        # Show the window again (changing flags hides it)
        self.show()

    def _show_about(self):
        """Show about dialog"""
        about_text = """<h2>ParserV3 - OUTERPLANE Character Extractor</h2>
<p><b>PyQt6 Edition</b></p>
<p>Version: 3.0</p>
<p>Date: October 2025</p>

<p>A complete character data extraction system for OUTERPLANE game files.</p>

<p><b>Features:</b></p>
<ul>
<li>Automatic extraction from .bytes files</li>
<li>Binary file explorer</li>
<li>Manual field editing</li>
<li>JSON comparison</li>
<li>Export management</li>
<li>Buff/Debuff metadata validation</li>
</ul>

<p><b>Author:</b> ParserV3 Team</p>"""

        QMessageBox.about(self, "About ParserV3", about_text)

    def _rip_assets(self):
        """Run the asset ripper script using QProcess"""
        # Confirm before starting
        reply = QMessageBox.question(
            self,
            "Rip Assets",
            "This will extract game assets using AssetStudioModCLI.\n\n"
            "<b>Assets to extract:</b>\n"
            "• Sprites (sprite)\n"
            "• Text files (textAsset)\n\n"
            "This process may take several minutes.\n\n"
            "Continue?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No
        )

        if reply != QMessageBox.StandardButton.Yes:
            return

        try:
            import os

            # Paths
            base_dir = DATAMINE_ROOT
            assetstudio_path = base_dir / "AssetStudioModCLI_net9_win64" / "AssetStudioModCLI.exe"
            input_dir = base_dir / "files"
            output_dir = base_dir / "extracted_astudio"

            # Check if AssetStudioModCLI exists
            if not assetstudio_path.exists():
                QMessageBox.critical(
                    self,
                    "Error",
                    f"AssetStudioModCLI not found at:\n{assetstudio_path}\n\n"
                    "Please make sure AssetStudioModCLI is installed in the datamine folder."
                )
                return

            # Check if input folder exists
            if not input_dir.exists():
                QMessageBox.critical(
                    self,
                    "Error",
                    f"Input folder not found at:\n{input_dir}\n\n"
                    "Please make sure game files are in the 'files' folder."
                )
                return

            # Clean output directory (remove old files to avoid duplicates)
            if output_dir.exists():
                self.statusBar().showMessage("Cleaning old extracted assets...")
                QApplication.processEvents()
                shutil.rmtree(output_dir, ignore_errors=True)

            # Create output directory
            output_dir.mkdir(parents=True, exist_ok=True)

            # Calculate max tasks
            reserve = 4
            max_parallel = 16
            cpu_threads = os.cpu_count() or 1
            usable_threads = max(cpu_threads - reserve, 1)
            max_tasks = min(usable_threads, max_parallel)

            # Store for later use in completion handler
            self.extraction_output_dir = output_dir
            self.extraction_max_tasks = max_tasks

            # Build command arguments (without the program itself)
            args = [
                str(input_dir),
                "--asset-type", "sprite,textAsset,tex2d",
                "--output", str(output_dir),
                "--max-export-tasks", str(max_tasks),
                "--log-level", "warning",
                "--log-output", "console"
            ]

            # Show progress dialog with progress bar
            self.progress_dialog = QProgressDialog("Initializing extraction...", None, 0, 100, self)
            self.progress_dialog.setWindowTitle("Ripping Assets")
            self.progress_dialog.setWindowModality(Qt.WindowModality.ApplicationModal)
            self.progress_dialog.setMinimumDuration(0)  # Show immediately
            self.progress_dialog.setCancelButton(None)  # No cancel button
            self.progress_dialog.setAutoClose(False)  # Don't auto-close
            self.progress_dialog.setAutoReset(False)  # Don't auto-reset
            self.progress_dialog.show()

            # Create QProcess
            self.extraction_process = QProcess(self)
            self.extraction_process.setWorkingDirectory(str(base_dir))

            # Connect signals
            self.extraction_process.finished.connect(self._on_extraction_finished)
            self.extraction_process.errorOccurred.connect(self._on_extraction_error)
            self.extraction_process.readyReadStandardOutput.connect(self._on_extraction_output)
            self.extraction_process.readyReadStandardError.connect(self._on_extraction_output)

            # Start the process
            logger.info(f"Starting extraction process: {assetstudio_path} {' '.join(args)}")
            self.extraction_process.start(str(assetstudio_path), args)

            if not self.extraction_process.waitForStarted(5000):
                raise Exception("Failed to start extraction process")

            self.statusBar().showMessage("Extracting assets in background...")
            logger.info("Extraction process started successfully")

        except Exception as e:
            logger.exception("Error starting asset ripping")
            if self.progress_dialog:
                self.progress_dialog.close()
                self.progress_dialog = None
            QMessageBox.critical(
                self,
                "Error",
                f"Failed to start asset extraction:\n\n{str(e)}"
            )
            self.statusBar().showMessage("Asset extraction error")

    def _on_extraction_output(self):
        """Handle extraction process output and update progress bar"""
        if self.extraction_process:
            output = self.extraction_process.readAllStandardOutput().data().decode('utf-8', errors='ignore')
            error = self.extraction_process.readAllStandardError().data().decode('utf-8', errors='ignore')

            # Parse progress from output like "Exported [1234/5678]"
            if output and self.progress_dialog:
                import re
                match = re.search(r'Exported \[(\d+)/(\d+)\]', output)
                if match:
                    current = int(match.group(1))
                    total = int(match.group(2))
                    percentage = int((current / total) * 100)
                    self.progress_dialog.setValue(percentage)
                    self.progress_dialog.setLabelText(f"Extracting assets: {current}/{total} ({percentage}%)")
                    # Only log every 100 assets to reduce spam
                    if current % 100 == 0 or current == total:
                        logger.info(f"Extraction progress: {current}/{total} ({percentage}%)")
                elif "[Info]" in output:
                    # Log important messages
                    logger.info(f"Extraction: {output.strip()}")

            if error:
                logger.warning(f"Extraction stderr: {error.strip()}")

    def _on_extraction_error(self, error):
        """Handle extraction process error"""
        logger.error(f"Extraction process error: {error}")

        # Close progress dialog
        if self.progress_dialog:
            self.progress_dialog.close()
            self.progress_dialog = None

        # Show error
        QMessageBox.critical(
            self,
            "Extraction Error",
            f"Extraction process failed with error: {error}"
        )
        self.statusBar().showMessage("Asset extraction failed")

        # Clean up
        if self.extraction_process:
            self.extraction_process.deleteLater()
            self.extraction_process = None

    def _on_extraction_finished(self, exit_code, exit_status):
        """Handle extraction process completion"""
        logger.info(f"Extraction finished: exit_code={exit_code}, exit_status={exit_status}")

        # Close progress dialog using hide() and deleteLater()
        if self.progress_dialog:
            logger.info("Hiding and deleting progress dialog...")
            self.progress_dialog.setValue(100)  # Set to 100% before closing
            self.progress_dialog.hide()
            self.progress_dialog.deleteLater()
            self.progress_dialog = None
            logger.info("Progress dialog hidden and scheduled for deletion")
        else:
            logger.warning("Progress dialog is None, cannot close")

        # Force process events to ensure dialog is removed
        QApplication.processEvents()

        # Show results with custom dialog
        if exit_code == 0:
            logger.info("Showing success message with restart button...")

            # Create custom message box with Restart button
            msg_box = QMessageBox(self)
            msg_box.setWindowTitle("Extraction Complete")
            msg_box.setIcon(QMessageBox.Icon.Information)
            msg_box.setText(
                f"Assets extracted successfully!\n\n"
                f"Output folder: {self.extraction_output_dir}\n"
                f"Used {self.extraction_max_tasks} parallel tasks.\n\n"
                f"The GUI needs to be restarted to use the extracted files."
            )

            # Add custom buttons
            restart_btn = msg_box.addButton("Restart GUI", QMessageBox.ButtonRole.AcceptRole)
            close_btn = msg_box.addButton("Close", QMessageBox.ButtonRole.RejectRole)

            msg_box.exec()

            # Check which button was clicked
            if msg_box.clickedButton() == restart_btn:
                logger.info("User clicked Restart GUI - restarting application...")
                self._restart_application()

            self.statusBar().showMessage("Asset extraction completed")
        else:
            logger.info("Showing error message...")
            QMessageBox.warning(
                self,
                "Extraction Error",
                f"Asset extraction completed with errors.\n\n"
                f"Exit code: {exit_code}\n\n"
                f"Check the console output for details."
            )
            self.statusBar().showMessage("Asset extraction failed")

        # Clean up process
        if self.extraction_process:
            logger.info("Cleaning up extraction process...")
            self.extraction_process.deleteLater()
            self.extraction_process = None

        logger.info("Extraction finished handler completed")

    def _extract_bgm(self):
        """Extract BGM files and generate mapping"""
        # Confirm before starting
        reply = QMessageBox.question(
            self,
            "BGM Extract",
            "This will extract BGM audio files and generate a mapping.\n\n"
            "<b>Actions:</b>\n"
            "1. Extract AudioClip assets (BGM only)\n"
            "2. Copy to public/audio/AudioClip\n"
            "3. Generate bgm_mapping.json in src/data\n\n"
            "Continue?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No
        )

        if reply != QMessageBox.StandardButton.Yes:
            return

        try:
            # Paths
            base_dir = DATAMINE_ROOT
            assetstudio_path = base_dir / "AssetStudioModCLI_net9_win64" / "AssetStudioModCLI.exe"
            input_dir = base_dir / "files"
            temp_output_dir = base_dir / "extracted_bgm_temp"

            # Check if AssetStudioModCLI exists
            if not assetstudio_path.exists():
                QMessageBox.critical(
                    self,
                    "Error",
                    f"AssetStudioModCLI not found at:\n{assetstudio_path}\n\n"
                    "Please make sure AssetStudioModCLI is installed in the datamine folder."
                )
                return

            # Check if input folder exists
            if not input_dir.exists():
                QMessageBox.critical(
                    self,
                    "Error",
                    f"Input folder not found at:\n{input_dir}\n\n"
                    "Please make sure game files are in the 'files' folder."
                )
                return

            # Clean temp output directory
            if temp_output_dir.exists():
                self.statusBar().showMessage("Cleaning temp folder...")
                QApplication.processEvents()
                shutil.rmtree(temp_output_dir, ignore_errors=True)

            temp_output_dir.mkdir(parents=True, exist_ok=True)

            # BGM regex pattern - matches all BGM file patterns
            bgm_regex = r"^(Agitpunkt|Battle_|Boss_|Event_|Guild_Agit|Intro|Lobby_|Remains_|Scene_|Gacha_BGM|Monadgate|Result_|RTPVP_|RuinIsland)"

            # Calculate max tasks
            reserve = 4
            max_parallel = 16
            cpu_threads = os.cpu_count() or 1
            usable_threads = max(cpu_threads - reserve, 1)
            max_tasks = min(usable_threads, max_parallel)

            # Store for later use
            self.bgm_temp_output_dir = temp_output_dir
            self.bgm_max_tasks = max_tasks

            # Build command arguments
            args = [
                str(input_dir),
                "--asset-type", "audio",
                "--output", str(temp_output_dir),
                "--group-option", "type",
                "--filter-by-name", bgm_regex,
                "--filter-with-regex",
                "--max-export-tasks", str(max_tasks),
                "--log-level", "info",
                "--log-output", "console"
            ]

            # Show progress dialog
            self.bgm_progress_dialog = QProgressDialog("Extracting BGM files...", None, 0, 100, self)
            self.bgm_progress_dialog.setWindowTitle("BGM Extract")
            self.bgm_progress_dialog.setWindowModality(Qt.WindowModality.ApplicationModal)
            self.bgm_progress_dialog.setMinimumDuration(0)
            self.bgm_progress_dialog.setCancelButton(None)
            self.bgm_progress_dialog.setAutoClose(False)
            self.bgm_progress_dialog.setAutoReset(False)
            self.bgm_progress_dialog.show()

            # Create QProcess
            self.bgm_process = QProcess(self)
            self.bgm_process.setWorkingDirectory(str(base_dir))

            # Connect signals
            self.bgm_process.finished.connect(self._on_bgm_extraction_finished)
            self.bgm_process.errorOccurred.connect(self._on_bgm_extraction_error)
            self.bgm_process.readyReadStandardOutput.connect(self._on_bgm_extraction_output)
            self.bgm_process.readyReadStandardError.connect(self._on_bgm_extraction_output)

            # Start the process
            logger.info(f"Starting BGM extraction: {assetstudio_path} {' '.join(args)}")
            self.bgm_process.start(str(assetstudio_path), args)

            if not self.bgm_process.waitForStarted(5000):
                raise Exception("Failed to start BGM extraction process")

            self.statusBar().showMessage("Extracting BGM files...")
            logger.info("BGM extraction process started")

        except Exception as e:
            logger.exception("Error starting BGM extraction")
            if hasattr(self, 'bgm_progress_dialog') and self.bgm_progress_dialog:
                self.bgm_progress_dialog.close()
                self.bgm_progress_dialog = None
            QMessageBox.critical(
                self,
                "Error",
                f"Failed to start BGM extraction:\n\n{str(e)}"
            )

    def _on_bgm_extraction_output(self):
        """Handle BGM extraction process output"""
        if self.bgm_process:
            output = self.bgm_process.readAllStandardOutput().data().decode('utf-8', errors='ignore')

            if output and hasattr(self, 'bgm_progress_dialog') and self.bgm_progress_dialog:
                import re
                match = re.search(r'Exported \[(\d+)/(\d+)\]', output)
                if match:
                    current = int(match.group(1))
                    total = int(match.group(2))
                    percentage = int((current / total) * 100) if total > 0 else 0
                    self.bgm_progress_dialog.setValue(percentage)
                    self.bgm_progress_dialog.setLabelText(f"Extracting BGM: {current}/{total}")

    def _on_bgm_extraction_error(self, error):
        """Handle BGM extraction error"""
        logger.error(f"BGM extraction error: {error}")

        if hasattr(self, 'bgm_progress_dialog') and self.bgm_progress_dialog:
            self.bgm_progress_dialog.close()
            self.bgm_progress_dialog = None

        QMessageBox.critical(self, "BGM Extraction Error", f"Process failed: {error}")

        if hasattr(self, 'bgm_process') and self.bgm_process:
            self.bgm_process.deleteLater()
            self.bgm_process = None

    def _on_bgm_extraction_finished(self, exit_code, exit_status):
        """Handle BGM extraction completion - copy files and generate mapping"""
        logger.info(f"BGM extraction finished: exit_code={exit_code}")

        if hasattr(self, 'bgm_progress_dialog') and self.bgm_progress_dialog:
            self.bgm_progress_dialog.setLabelText("Processing BGM files...")
            self.bgm_progress_dialog.setValue(50)
            QApplication.processEvents()

        if exit_code == 0:
            try:
                # Find all .wav files in the temp output directory (recursive)
                wav_files = list(self.bgm_temp_output_dir.rglob("*.wav"))

                if not wav_files:
                    # Log what was created for debugging
                    logger.warning(f"No .wav files found. Contents of {self.bgm_temp_output_dir}:")
                    for item in self.bgm_temp_output_dir.rglob("*"):
                        logger.warning(f"  {item}")
                    raise Exception(f"No audio files found in {self.bgm_temp_output_dir}")

                logger.info(f"Found {len(wav_files)} .wav files")

                # Create output folder
                BGM_OUTPUT_FOLDER.mkdir(parents=True, exist_ok=True)

                # Copy files
                if hasattr(self, 'bgm_progress_dialog') and self.bgm_progress_dialog:
                    self.bgm_progress_dialog.setLabelText("Copying BGM files...")
                    QApplication.processEvents()
                for i, wav_file in enumerate(wav_files):
                    dest = BGM_OUTPUT_FOLDER / wav_file.name
                    shutil.copy2(wav_file, dest)
                    if hasattr(self, 'bgm_progress_dialog') and self.bgm_progress_dialog:
                        progress = 50 + int((i / len(wav_files)) * 25) if wav_files else 75
                        self.bgm_progress_dialog.setValue(progress)
                        QApplication.processEvents()

                logger.info(f"Copied {len(wav_files)} BGM files to {BGM_OUTPUT_FOLDER}")

                # Generate mapping
                if hasattr(self, 'bgm_progress_dialog') and self.bgm_progress_dialog:
                    self.bgm_progress_dialog.setLabelText("Generating BGM mapping...")
                    self.bgm_progress_dialog.setValue(80)
                    QApplication.processEvents()

                mapping = self._generate_bgm_mapping(BGM_OUTPUT_FOLDER)

                # Save mapping
                BGM_MAPPING_FOLDER.mkdir(parents=True, exist_ok=True)
                mapping_path = BGM_MAPPING_FOLDER / "bgm_mapping.json"
                with open(mapping_path, "w", encoding="utf-8") as f:
                    json.dump(mapping, f, ensure_ascii=False, indent=2)

                logger.info(f"Saved BGM mapping to {mapping_path}")

                # Clean up temp folder
                if self.bgm_temp_output_dir.exists():
                    shutil.rmtree(self.bgm_temp_output_dir, ignore_errors=True)

                # Close progress dialog
                if hasattr(self, 'bgm_progress_dialog') and self.bgm_progress_dialog:
                    self.bgm_progress_dialog.setValue(100)
                    self.bgm_progress_dialog.hide()
                    self.bgm_progress_dialog.deleteLater()
                    self.bgm_progress_dialog = None

                QMessageBox.information(
                    self,
                    "BGM Extract Complete",
                    f"Successfully extracted {len(wav_files)} BGM files!\n\n"
                    f"Audio files: {BGM_OUTPUT_FOLDER}\n"
                    f"Mapping: {mapping_path}\n\n"
                    f"Mapping contains {len(mapping)} entries."
                )

            except Exception as e:
                logger.exception("Error processing BGM files")
                if hasattr(self, 'bgm_progress_dialog') and self.bgm_progress_dialog:
                    self.bgm_progress_dialog.close()
                    self.bgm_progress_dialog = None
                QMessageBox.critical(self, "Error", f"Failed to process BGM files:\n\n{str(e)}")
        else:
            if hasattr(self, 'bgm_progress_dialog') and self.bgm_progress_dialog:
                self.bgm_progress_dialog.close()
                self.bgm_progress_dialog = None
            QMessageBox.warning(
                self,
                "BGM Extraction Error",
                f"Extraction failed with exit code: {exit_code}"
            )

        # Clean up process
        if hasattr(self, 'bgm_process') and self.bgm_process:
            self.bgm_process.deleteLater()
            self.bgm_process = None

        self.statusBar().showMessage("BGM extraction completed")

    def _generate_bgm_mapping(self, audio_folder: Path) -> list:
        """Generate BGM file to name mapping with all languages"""

        # Parse jukebox data if available (with all languages)
        jukebox_mapping = {}  # file -> {en, jp, kr, zh}
        try:
            bgm_parser = Bytes_parser(str(BYTES_FOLDER / "LobbyCustomResourceTemplet.bytes"))
            bgm_data = bgm_parser.get_data()
            bgm_entries = [d for d in bgm_data if d.get("Type") == "LRT_BGM"]

            text_parser = Bytes_parser(str(BYTES_FOLDER / "TextSystem.bytes"))
            text_data = text_parser.get_data()

            # Build translations dict with all languages
            translations = {}
            for d in text_data:
                id_symbol = d.get("IDSymbol")
                if id_symbol:
                    translations[id_symbol] = {
                        "en": d.get("English", ""),
                        "jp": d.get("Japanese", ""),
                        "kr": d.get("Korean", ""),
                        "zh": d.get("China_Simplified", ""),
                    }

            for entry in bgm_entries:
                resource = entry.get("ResourceFile", "")
                name_key = entry.get("NAME", "")
                names = translations.get(name_key, {})

                for part in resource.split(","):
                    part = part.strip()
                    if part and names.get("en"):
                        jukebox_mapping[part] = names

            logger.info(f"Loaded {len(jukebox_mapping)} jukebox entries")
        except Exception as e:
            logger.warning(f"Could not load jukebox data: {e}")

        # Build mapping from audio files
        result = []
        for wav_file in sorted(audio_folder.glob("*.wav")):
            filename = wav_file.stem  # Remove .wav

            if filename in jukebox_mapping:
                names = jukebox_mapping[filename]
                entry = {"file": filename, "name": names.get("en", "")}
                # Add other languages only if they exist
                if names.get("jp"):
                    entry["name_jp"] = names["jp"]
                if names.get("kr"):
                    entry["name_kr"] = names["kr"]
                if names.get("zh"):
                    entry["name_zh"] = names["zh"]
            else:
                # No jukebox entry: use filename with underscores replaced by spaces
                entry = {"file": filename, "name": filename.replace("_", " ")}

            result.append(entry)

        return result

    def _restart_application(self):
        """Restart the application"""
        import sys
        import os

        logger.info("Restarting application...")

        # Get the python executable and script path
        python = sys.executable
        script = sys.argv[0]

        # Close the current application
        QApplication.quit()

        # Start a new instance
        os.execl(python, python, script, *sys.argv[1:])


def main():
    """Main entry point"""
    import sys

    app = QApplication(sys.argv)
    app.setStyle('Fusion')  # Modern style

    # Set dark theme globally
    dark_stylesheet = """
        QMainWindow, QWidget {
            background-color: #2b2b2b;
            color: #ffffff;
        }
        QLabel {
            color: #ffffff;
        }
        QLineEdit, QTextEdit, QComboBox, QSpinBox {
            background-color: #3c3c3c;
            color: #ffffff;
            border: 1px solid #555;
            padding: 3px;
        }
        QLineEdit:focus, QTextEdit:focus, QComboBox:focus {
            border: 1px solid #0078d7;
        }
        QPushButton {
            background-color: #3c3c3c;
            color: #ffffff;
            border: 1px solid #555;
            padding: 5px 15px;
            min-height: 20px;
        }
        QPushButton:hover {
            background-color: #4c4c4c;
        }
        QPushButton:pressed {
            background-color: #2c2c2c;
        }
        QPushButton:disabled {
            background-color: #2b2b2b;
            color: #666;
        }
        QGroupBox {
            color: #ffffff;
            border: 1px solid #555;
            border-radius: 5px;
            margin-top: 10px;
            padding-top: 10px;
        }
        QGroupBox::title {
            subcontrol-origin: margin;
            subcontrol-position: top left;
            padding: 0 5px;
            color: #ffffff;
        }
        QTableWidget, QTreeView {
            background-color: #1e1e1e;
            color: #ffffff;
            border: 1px solid #555;
            gridline-color: #555;
        }
        QTableWidget::item, QTreeView::item {
            color: #ffffff;
        }
        QHeaderView::section {
            background-color: #3c3c3c;
            color: #ffffff;
            border: 1px solid #555;
            padding: 4px;
        }
        QTabWidget::pane {
            border: 1px solid #555;
            background-color: #2b2b2b;
        }
        QTabBar::tab {
            background-color: #3c3c3c;
            color: #ffffff;
            border: 1px solid #555;
            padding: 5px 10px;
        }
        QTabBar::tab:selected {
            background-color: #0078d7;
        }
        QTabBar::tab:hover {
            background-color: #4c4c4c;
        }
        QComboBox::drop-down {
            border: none;
        }
        QComboBox QAbstractItemView {
            background-color: #3c3c3c;
            color: #ffffff;
            selection-background-color: #0078d7;
        }
        QMenuBar {
            background-color: #2b2b2b;
            color: #ffffff;
        }
        QMenuBar::item:selected {
            background-color: #3c3c3c;
        }
        QMenu {
            background-color: #2b2b2b;
            color: #ffffff;
            border: 1px solid #555;
        }
        QMenu::item:selected {
            background-color: #0078d7;
        }
        QStatusBar {
            background-color: #2b2b2b;
            color: #ffffff;
        }
    """
    app.setStyleSheet(dark_stylesheet)

    window = ParserV3MainWindow()
    window.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
