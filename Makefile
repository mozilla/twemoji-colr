FONT_NAME  = EmojiOne

BUILD_DIR  = build

FINAL_TARGET = $(BUILD_DIR)/$(FONT_NAME).ttf

SVGS       = e1-svg.zip
EXTRA_DIR  = extras

LAYERIZE   = layerize.js
TTX        = ttx

CODEPOINTS = $(BUILD_DIR)/codepoints.js
OT_SOURCE  = $(BUILD_DIR)/$(FONT_NAME).ttx
RAW_FONT   = $(BUILD_DIR)/raw-font/$(FONT_NAME).ttf

$(FINAL_TARGET) : $(RAW_FONT) $(OT_SOURCE)
	rm -f $(FINAL_TARGET)
	$(TTX) -m $(RAW_FONT) $(OT_SOURCE)

$(RAW_FONT) : $(CODEPOINTS)
	grunt webfont

$(CODEPOINTS) $(OT_SOURCE): $(LAYERIZE) $(SVGS) $(EXTRA_DIR)/*.svg
	node $(LAYERIZE) $(SVGS) $(EXTRA_DIR) $(BUILD_DIR) $(FONT_NAME)
