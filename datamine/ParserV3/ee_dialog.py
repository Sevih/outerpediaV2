"""
EE Dialog - Select buffs/debuffs for Exclusive Equipment

Allows user to select multiple buffs and debuffs from the available lists
before saving to ee.json

Author: ParserV3
Date: 2025-10
"""

from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QGroupBox, QScrollArea, QWidget, QCheckBox, QComboBox, QTextBrowser
)
from PyQt6.QtCore import Qt
from pathlib import Path
import json


class EEBuffDebuffDialog(QDialog):
    """Dialog for selecting buffs/debuffs for EE"""

    def __init__(self, parent, character_name: str, existing_buffs: list = None, existing_debuffs: list = None, existing_rank: str = None, ee_effect: str = None, ee_effect10: str = None):
        super().__init__(parent)
        self.character_name = character_name
        self.existing_buffs = existing_buffs or []
        self.existing_debuffs = existing_debuffs or []
        self.existing_rank = existing_rank or ''  # Default to empty
        self.ee_effect = ee_effect or ''  # Effect text
        self.ee_effect10 = ee_effect10 or ''  # Effect10 text
        self.result = None  # Will be dict with 'buff', 'debuff', and 'rank', or None if cancelled

        # Store checkboxes for easy access
        self.buff_checkboxes = {}  # {buff_name: QCheckBox}
        self.debuff_checkboxes = {}  # {debuff_name: QCheckBox}

        self.setWindowTitle(f"Select Buffs/Debuffs for EE: {character_name}")
        self.setModal(True)
        self.resize(900, 700)

        self._load_effects()
        self._setup_ui()

    def _load_effects(self):
        """Load buffs and debuffs from JSON files"""
        try:
            from config import BUFFS_FILE, DEBUFFS_FILE
            buffs_path = BUFFS_FILE
            debuffs_path = DEBUFFS_FILE

            with open(buffs_path, 'r', encoding='utf-8') as f:
                self.buffs_data = json.load(f)

            with open(debuffs_path, 'r', encoding='utf-8') as f:
                self.debuffs_data = json.load(f)

        except Exception as e:
            print(f"Error loading buffs/debuffs: {e}")
            self.buffs_data = []
            self.debuffs_data = []

    def _setup_ui(self):
        """Setup the dialog UI"""
        layout = QVBoxLayout(self)

        # Dark theme
        self.setStyleSheet("""
            QDialog {
                background-color: #2b2b2b;
                color: #ffffff;
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
            QScrollArea {
                background-color: #3c3c3c;
                border: 1px solid #555;
            }
            QCheckBox {
                color: #ffffff;
                padding: 5px;
            }
            QCheckBox::indicator {
                width: 18px;
                height: 18px;
                border: 1px solid #555;
                background-color: #3c3c3c;
            }
            QCheckBox::indicator:checked {
                background-color: #4a90e2;
                border: 1px solid #2a70c2;
            }
            QCheckBox:hover {
                background-color: #4c4c4c;
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
            QPushButton#save_btn {
                background-color: #28a745;
                border: 1px solid #1e7e34;
            }
            QPushButton#save_btn:hover {
                background-color: #34ce57;
            }
            QComboBox {
                background-color: #3c3c3c;
                color: #ffffff;
                border: 1px solid #555;
                padding: 5px;
                min-height: 25px;
            }
            QComboBox:hover {
                background-color: #4c4c4c;
            }
            QComboBox::drop-down {
                border: none;
            }
            QComboBox QAbstractItemView {
                background-color: #3c3c3c;
                color: #ffffff;
                selection-background-color: #4a90e2;
            }
            QTextBrowser {
                background-color: #1e1e1e;
                color: #ffffff;
                border: 1px solid #555;
                padding: 8px;
            }
        """)

        # Title
        title_label = QLabel(f"<h2>Select Buffs/Debuffs for {self.character_name}</h2>")
        layout.addWidget(title_label)

        # EE Effects display
        if self.ee_effect or self.ee_effect10:
            effects_group = QGroupBox("EE Effects")
            effects_layout = QVBoxLayout()

            if self.ee_effect:
                effect_label = QLabel("<b>Effect (Base):</b>")
                effects_layout.addWidget(effect_label)

                effect_browser = QTextBrowser()
                effect_browser.setHtml(self.ee_effect)
                effect_browser.setMaximumHeight(60)
                effect_browser.setOpenExternalLinks(False)
                effects_layout.addWidget(effect_browser)

            if self.ee_effect10:
                effect10_label = QLabel("<b>Effect (+10):</b>")
                effects_layout.addWidget(effect10_label)

                effect10_browser = QTextBrowser()
                effect10_browser.setHtml(self.ee_effect10)
                effect10_browser.setMaximumHeight(60)
                effect10_browser.setOpenExternalLinks(False)
                effects_layout.addWidget(effect10_browser)

            effects_group.setLayout(effects_layout)
            layout.addWidget(effects_group)

        # Rank selector
        rank_layout = QHBoxLayout()
        rank_label = QLabel("Rank:")
        rank_label.setFixedWidth(50)

        self.rank_combo = QComboBox()
        self.rank_combo.addItems(['', 'S', 'A', 'B', 'C', 'D'])

        # Set existing rank if any
        if self.existing_rank:
            index = self.rank_combo.findText(self.existing_rank)
            if index >= 0:
                self.rank_combo.setCurrentIndex(index)

        self.rank_combo.setFixedWidth(100)
        rank_layout.addWidget(rank_label)
        rank_layout.addWidget(self.rank_combo)
        rank_layout.addStretch()

        layout.addLayout(rank_layout)

        # Info
        info_label = QLabel("Check the buffs and debuffs you want to add to this character's EE.")
        info_label.setWordWrap(True)
        layout.addWidget(info_label)

        # Main content area with two checkbox lists side by side
        lists_layout = QHBoxLayout()

        # Buffs checkboxes
        buffs_group = QGroupBox("Buffs")
        buffs_group_layout = QVBoxLayout()

        # Create scroll area for buffs
        buffs_scroll = QScrollArea()
        buffs_scroll.setWidgetResizable(True)
        buffs_scroll.setMinimumHeight(400)

        buffs_widget = QWidget()
        buffs_widget_layout = QVBoxLayout(buffs_widget)
        buffs_widget_layout.setAlignment(Qt.AlignmentFlag.AlignTop)

        # Populate buffs with checkboxes (sorted alphabetically by label)
        sorted_buffs = sorted(self.buffs_data, key=lambda x: x.get('label', x.get('name', '')).lower())
        for buff in sorted_buffs:
            name = buff.get('name', '')
            label = buff.get('label', name)

            checkbox = QCheckBox(label)
            checkbox.setObjectName(name)

            # Pre-check if in existing_buffs
            if name in self.existing_buffs:
                checkbox.setChecked(True)

            self.buff_checkboxes[name] = checkbox
            buffs_widget_layout.addWidget(checkbox)

        buffs_scroll.setWidget(buffs_widget)
        buffs_group_layout.addWidget(buffs_scroll)
        buffs_group.setLayout(buffs_group_layout)
        lists_layout.addWidget(buffs_group)

        # Debuffs checkboxes
        debuffs_group = QGroupBox("Debuffs")
        debuffs_group_layout = QVBoxLayout()

        # Create scroll area for debuffs
        debuffs_scroll = QScrollArea()
        debuffs_scroll.setWidgetResizable(True)
        debuffs_scroll.setMinimumHeight(400)

        debuffs_widget = QWidget()
        debuffs_widget_layout = QVBoxLayout(debuffs_widget)
        debuffs_widget_layout.setAlignment(Qt.AlignmentFlag.AlignTop)

        # Populate debuffs with checkboxes (sorted alphabetically by label)
        sorted_debuffs = sorted(self.debuffs_data, key=lambda x: x.get('label', x.get('name', '')).lower())
        for debuff in sorted_debuffs:
            name = debuff.get('name', '')
            label = debuff.get('label', name)

            checkbox = QCheckBox(label)
            checkbox.setObjectName(name)

            # Pre-check if in existing_debuffs
            if name in self.existing_debuffs:
                checkbox.setChecked(True)

            self.debuff_checkboxes[name] = checkbox
            debuffs_widget_layout.addWidget(checkbox)

        debuffs_scroll.setWidget(debuffs_widget)
        debuffs_group_layout.addWidget(debuffs_scroll)
        debuffs_group.setLayout(debuffs_group_layout)
        lists_layout.addWidget(debuffs_group)

        layout.addLayout(lists_layout)

        # Buttons
        button_layout = QHBoxLayout()

        save_btn = QPushButton("Save & Continue")
        save_btn.setObjectName("save_btn")
        save_btn.clicked.connect(self._on_save)
        button_layout.addWidget(save_btn)

        cancel_btn = QPushButton("Cancel")
        cancel_btn.clicked.connect(self.reject)
        button_layout.addWidget(cancel_btn)

        layout.addLayout(button_layout)

        # Helper text
        helper_text = QLabel(
            "<b>Note:</b> You can select multiple buffs and debuffs by checking the boxes."
        )
        helper_text.setWordWrap(True)
        helper_text.setStyleSheet("margin-top: 10px; padding: 10px; background-color: #3c3c3c; border-radius: 5px;")
        layout.addWidget(helper_text)

    def _on_save(self):
        """Save checked buffs/debuffs and rank"""
        # Get checked buffs
        selected_buffs = []
        for buff_name, checkbox in self.buff_checkboxes.items():
            if checkbox.isChecked():
                selected_buffs.append(buff_name)

        # Get checked debuffs
        selected_debuffs = []
        for debuff_name, checkbox in self.debuff_checkboxes.items():
            if checkbox.isChecked():
                selected_debuffs.append(debuff_name)

        # Get selected rank
        selected_rank = self.rank_combo.currentText()

        # Set result
        self.result = {
            'buff': selected_buffs,
            'debuff': selected_debuffs,
            'rank': selected_rank
        }

        self.accept()
