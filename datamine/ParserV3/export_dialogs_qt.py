"""
Export dialogs for PyQt6 GUI - Metadata input for missing buffs/debuffs

Author: ParserV3
Date: 2025-10
"""

from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QFormLayout,
    QPushButton, QLineEdit, QTextEdit, QLabel, QGroupBox, QComboBox, QFileDialog
)
from PyQt6.QtCore import Qt
from pathlib import Path
import json
import shutil


class MetadataInputDialog(QDialog):
    """Dialog for inputting/editing buff/debuff metadata"""

    def __init__(self, parent, effect_name: str, is_buff: bool, metadata: dict):
        super().__init__(parent)
        self.effect_name = effect_name
        self.is_buff = is_buff
        self.metadata = metadata
        self.result = None

        self.setWindowTitle(f"Missing {'Buff' if is_buff else 'Debuff'}: {effect_name}")
        self.setModal(True)
        self.resize(600, 500)

        self._setup_ui()

    def _setup_ui(self):
        """Setup the dialog UI"""
        layout = QVBoxLayout(self)

        # Set dark theme for the dialog
        self.setStyleSheet("""
            QDialog {
                background-color: #2b2b2b;
                color: #ffffff;
            }
            QLineEdit, QTextEdit {
                background-color: #3c3c3c;
                color: #ffffff;
                border: 1px solid #555;
                padding: 5px;
            }
            QLabel {
                color: #ffffff;
            }
            QGroupBox {
                color: #ffffff;
                font-weight: bold;
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
            QPushButton {
                background-color: #3c3c3c;
                color: #ffffff;
                border: 1px solid #555;
                padding: 8px 15px;
                min-height: 25px;
            }
            QPushButton:hover {
                background-color: #4c4c4c;
            }
            QPushButton#add_btn {
                background-color: #28a745;
                border: 1px solid #1e7e34;
            }
            QPushButton#add_btn:hover {
                background-color: #34ce57;
            }
            QPushButton#ignore_btn {
                background-color: #ff8800;
                border: 1px solid #cc6600;
            }
            QPushButton#ignore_btn:hover {
                background-color: #ffa040;
            }
            QPushButton#skip_btn {
                background-color: #6c757d;
                border: 1px solid #545b62;
            }
            QPushButton#skip_btn:hover {
                background-color: #7c858d;
            }
        """)

        # Title
        title_label = QLabel(f"<h2>{'Buff' if self.is_buff else 'Debuff'}: {self.effect_name}</h2>")
        layout.addWidget(title_label)

        # Info label
        info_label = QLabel("This effect is missing from the database. Please review and choose an action:")
        info_label.setWordWrap(True)
        layout.addWidget(info_label)

        # Metadata group
        meta_group = QGroupBox("Extracted Metadata")
        meta_layout = QFormLayout()

        # Label (English)
        self.label_edit = QLineEdit(self.metadata.get('label', ''))
        meta_layout.addRow("Label (EN):", self.label_edit)

        # Label JP
        self.label_jp_edit = QLineEdit(self.metadata.get('label_jp', ''))
        meta_layout.addRow("Label (JP):", self.label_jp_edit)

        # Label KR
        self.label_kr_edit = QLineEdit(self.metadata.get('label_kr', ''))
        meta_layout.addRow("Label (KR):", self.label_kr_edit)

        # Label ZH
        self.label_zh_edit = QLineEdit(self.metadata.get('label_zh', ''))
        meta_layout.addRow("Label (ZH):", self.label_zh_edit)

        # Description (English)
        self.desc_edit = QTextEdit()
        self.desc_edit.setPlainText(self.metadata.get('description', ''))
        self.desc_edit.setMaximumHeight(100)
        meta_layout.addRow("Description (EN):", self.desc_edit)

        # Description JP
        self.desc_jp_edit = QTextEdit()
        self.desc_jp_edit.setPlainText(self.metadata.get('description_jp', ''))
        self.desc_jp_edit.setMaximumHeight(100)
        meta_layout.addRow("Description (JP):", self.desc_jp_edit)

        # Description KR
        self.desc_kr_edit = QTextEdit()
        self.desc_kr_edit.setPlainText(self.metadata.get('description_kr', ''))
        self.desc_kr_edit.setMaximumHeight(100)
        meta_layout.addRow("Description (KR):", self.desc_kr_edit)

        # Description ZH
        self.desc_zh_edit = QTextEdit()
        self.desc_zh_edit.setPlainText(self.metadata.get('description_zh', ''))
        self.desc_zh_edit.setMaximumHeight(100)
        meta_layout.addRow("Description (ZH):", self.desc_zh_edit)

        # Icon (required)
        icon_layout = QHBoxLayout()
        self.icon_edit = QLineEdit(self.metadata.get('icon', ''))
        self.icon_edit.setPlaceholderText("Required: Select an icon file")
        icon_layout.addWidget(self.icon_edit)

        icon_browse_btn = QPushButton("Browse...")
        icon_browse_btn.clicked.connect(self._browse_icon)
        icon_browse_btn.setMaximumWidth(100)
        icon_layout.addWidget(icon_browse_btn)

        meta_layout.addRow("Icon *:", icon_layout)

        # Category (required)
        self.category_combo = QComboBox()
        self._load_categories()
        meta_layout.addRow("Category *:", self.category_combo)

        # Group (optional) - for grouping similar effects together in filters
        self.group_edit = QLineEdit(self.metadata.get('group', ''))
        self.group_edit.setPlaceholderText("Optional: e.g., BT_CALL_BACKUP for variants")
        meta_layout.addRow("Group (optional):", self.group_edit)

        meta_group.setLayout(meta_layout)
        layout.addWidget(meta_group)

        # Buttons
        button_layout = QHBoxLayout()

        add_btn = QPushButton("Add to Database")
        add_btn.setObjectName("add_btn")
        add_btn.clicked.connect(self._on_add)
        button_layout.addWidget(add_btn)

        ignore_btn = QPushButton("Ignore (Add to Ignored List)")
        ignore_btn.setObjectName("ignore_btn")
        ignore_btn.clicked.connect(self._on_ignore)
        button_layout.addWidget(ignore_btn)

        skip_btn = QPushButton("Skip (Don't Add)")
        skip_btn.setObjectName("skip_btn")
        skip_btn.clicked.connect(self._on_skip)
        button_layout.addWidget(skip_btn)

        layout.addLayout(button_layout)

        # Info text
        info_text = QLabel(
            "<b>Add to Database</b>: Adds this effect with the provided metadata<br>"
            "<b>Ignore</b>: Adds to ignored_effects.json (won't appear in future exports)<br>"
            "<b>Skip</b>: Does nothing (will appear again on next export)"
        )
        info_text.setWordWrap(True)
        info_text.setStyleSheet("margin-top: 10px; padding: 10px; background-color: #3c3c3c; border-radius: 5px;")
        layout.addWidget(info_text)

    def _load_categories(self):
        """Load categories from effect_categories.json"""
        try:
            # ParserV3 -> datamine -> outerpedia-clean -> src -> data
            project_root = Path(__file__).parent.parent.parent
            categories_path = project_root / "src" / "data" / "effect_categories.json"
            with open(categories_path, 'r', encoding='utf-8') as f:
                categories_data = json.load(f)

            # Get categories for buff or debuff
            effect_type = 'buff' if self.is_buff else 'debuff'
            categories = categories_data.get(effect_type, {})

            # Populate combo box
            self.category_combo.addItem("-- Select Category --", None)
            for category_key, category_info in categories.items():
                label = category_info.get('label', category_key)
                self.category_combo.addItem(label, category_key)

            # Select existing category if present in metadata
            existing_category = self.metadata.get('category')
            if existing_category:
                # Find index of this category
                for i in range(self.category_combo.count()):
                    if self.category_combo.itemData(i) == existing_category:
                        self.category_combo.setCurrentIndex(i)
                        break

        except Exception as e:
            print(f"Error loading categories: {e}")
            # Fallback: add basic categories
            if self.is_buff:
                self.category_combo.addItems(["statBoosts", "supporting", "utility", "unique", "hidden"])
            else:
                self.category_combo.addItems(["statReduction", "cc", "dot", "utility", "unique", "hidden"])

    def _browse_icon(self):
        """Browse for icon file"""
        # ParserV3 -> datamine -> outerpedia-clean
        project_root = Path(__file__).parent.parent.parent

        # Primary: public/images/ui/effect
        primary_dir = project_root / "public" / "images" / "ui" / "effect"

        # Backup: datamine/extracted_astudio/assets/editor/resources/sprite
        backup_dir = project_root / "datamine" / "extracted_astudio" / "assets" / "editor" / "resources" / "sprite"

        # Start in primary directory if it exists, otherwise backup
        start_dir = str(primary_dir) if primary_dir.exists() else str(backup_dir)

        # Open file dialog
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "Select Icon File",
            start_dir,
            "Image Files (*.png *.jpg *.jpeg *.webp);;All Files (*.*)"
        )

        if file_path:
            source_path = Path(file_path)
            icon_name = source_path.stem

            # Check if file is from backup directory (sprite)
            if backup_dir.exists() and backup_dir in source_path.parents:
                # Copy to primary directory
                primary_dir.mkdir(parents=True, exist_ok=True)
                dest_path = primary_dir / source_path.name

                try:
                    # Copy the file
                    shutil.copy2(source_path, dest_path)
                    print(f"Copied icon from sprite to effect: {source_path.name}")

                    # Create WebP version if not already WebP
                    if source_path.suffix.lower() != '.webp':
                        from webp_converter import WebPConverter
                        converter = WebPConverter()
                        webp_path = primary_dir / f"{icon_name}.webp"

                        if not webp_path.exists():
                            converter.convert_single(str(dest_path), str(webp_path))
                            print(f"Created WebP version: {webp_path.name}")
                        else:
                            print(f"WebP already exists: {webp_path.name}")

                except Exception as e:
                    print(f"Error copying/converting icon: {e}")
                    from PyQt6.QtWidgets import QMessageBox
                    QMessageBox.warning(self, "Copy Error", f"Failed to copy icon:\n{str(e)}")
                    return

            self.icon_edit.setText(icon_name)

    def _on_add(self):
        """Add to database with metadata"""
        from PyQt6.QtWidgets import QMessageBox

        # Validate icon (required)
        icon_value = self.icon_edit.text().strip()
        if not icon_value:
            QMessageBox.warning(self, "Missing Icon", "Icon is required! Please select an icon file.")
            return

        # Get category from combo box (required)
        category_data = self.category_combo.currentData()
        if not category_data or category_data == "-- Select Category --":
            QMessageBox.warning(self, "Missing Category", "Category is required! Please select a category.")
            return

        # Get group (optional)
        group_value = self.group_edit.text().strip() or None

        self.result = {
            'label': self.label_edit.text().strip() or None,
            'label_jp': self.label_jp_edit.text().strip() or None,
            'label_kr': self.label_kr_edit.text().strip() or None,
            'label_zh': self.label_zh_edit.text().strip() or None,
            'description': self.desc_edit.toPlainText().strip() or None,
            'description_jp': self.desc_jp_edit.toPlainText().strip() or None,
            'description_kr': self.desc_kr_edit.toPlainText().strip() or None,
            'description_zh': self.desc_zh_edit.toPlainText().strip() or None,
            'icon': icon_value,
            'category': category_data,  # Can be None if "-- Select Category --"
            'group': group_value  # Optional: for grouping similar effects
        }
        self.accept()

    def _on_ignore(self):
        """Add to ignored list"""
        self.result = 'ignore'
        self.accept()

    def _on_skip(self):
        """Skip this effect"""
        self.result = 'skip'
        self.accept()
