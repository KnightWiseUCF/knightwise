////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          jest.config.js
//  Description:   Backend Jest test configuration file
//
////////////////////////////////////////////////////////////////

module.exports = {
  testEnvironment: 'node',
  maxWorkers: 1, // Runs test suites serially, prevents races
  setupFiles: ['<rootDir>/config/env.js'],
  reporters: [
    'default',
    [
      'jest-html-reporter',
      {
        pageTitle: 'Test Report',
        outputPath: './test-report.html',
        includeFailureMsg: true,
        includeConsoleLog: true
      }
    ]
  ]
};
  