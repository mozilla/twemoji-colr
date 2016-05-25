/*jshint node:true*/

var path = require('path');

module.exports = function(grunt) {
	'use strict';

	require('load-grunt-tasks')(grunt);

	grunt.initConfig({
		webfont: {
            EmojiOne: {
                src: 'build/glyphs/*.svg',
                dest: 'build/raw-font',
                options: {
                    font: 'EmojiOne Mozilla',
                    types: 'ttf',
					codepointsFile: 'build/codepoints.js'
                }
            },
		},
	});

	grunt.loadTasks('grunt-webfont/tasks');

	grunt.registerTask('default', ['webfont']);
};
