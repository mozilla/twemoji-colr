/*jshint node:true*/

module.exports = function (grunt) {
    'use strict';

    require('load-grunt-tasks')(grunt);
    const packageJSON = grunt.file.readJSON('package.json');

    grunt.initConfig({
        webfont: {
            Twemoji: {
                src: 'build/glyphs/*.svg',
                dest: 'build/raw-font',
                options: {
                    font: 'Twemoji Mozilla',
                    engine: 'fontforge',
                    types: 'ttf',
                    autoHint: false,
                    execMaxBuffer: 1024 * 1000,
                    version: packageJSON.version,
                    codepointsFile: 'build/codepoints.js'
                }
            },
        },
    });

    grunt.loadNpmTasks('grunt-webfonts');
    grunt.registerTask('default', ['webfont']);
};
