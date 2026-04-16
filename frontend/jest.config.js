/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/*.test.ts'],
    moduleFileExtensions: ['ts', 'tsx', 'js'],
    moduleNameMapper: {
        '^uuid$': '<rootDir>/src/__mocks__/uuid.ts',
    },
};
