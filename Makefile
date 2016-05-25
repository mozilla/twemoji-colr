FONT_NAME  = EmojiOne\ Mozilla

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
	# remove illegal <space> from the PostScript name in the font
	$(TTX) -t name -o $(RAW_FONT).names $(RAW_FONT)
	perl -i -e 'my $$ps = 0;' \
	        -e 'while(<>) {' \
	        -e '  $$ps = 1 if m/nameID="6"/;' \
	        -e '  $$ps = 0 if m|</namerecord>|;' \
	        -e '  s/EmojiOne Mozilla/EmojiOneMozilla/ if $$ps;' \
	        -e '  print;' \
	        -e '}' $(RAW_FONT).names
	$(TTX) -m $(RAW_FONT) -o $(RAW_FONT).renamed $(RAW_FONT).names
	$(TTX) -m $(RAW_FONT).renamed $(OT_SOURCE)

$(RAW_FONT) : $(CODEPOINTS)
	grunt webfont

$(CODEPOINTS) $(OT_SOURCE) : $(LAYERIZE) $(SVGS) $(EXTRA_DIR)/*.svg
	node $(LAYERIZE) $(SVGS) $(EXTRA_DIR) $(BUILD_DIR) $(FONT_NAME)
