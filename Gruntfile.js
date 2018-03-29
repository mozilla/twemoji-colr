/*jshint node:true*/

var path = require('path');

module.exports = function(grunt) {
	'use strict';

	require('load-grunt-tasks')(grunt);

    var packageJSON = grunt.file.readJSON('package.json');

	grunt.initConfig({
		webfont: {
            Twemoji: {
                src: 'build/glyphs/*.svg',
                dest: 'build/raw-font',
                options: {
                    font: 'Twemoji Mozilla',
                    types: 'ttf',
                    autoHint: false,
                    execMaxBuffer: 1024 * 1000,
                    version: packageJSON.version,
                    codepointsFile: 'build/codepoints.js'
                }
            },
		},
	});

	grunt.loadNpmTasks('grunt-webfont');

	grunt.registerTask('default', ['webfont']);
};
