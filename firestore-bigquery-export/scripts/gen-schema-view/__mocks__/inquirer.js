const prompt = jest.fn().mockResolvedValue({});
const createPromptModule = jest.fn().mockReturnValue(prompt);

const inquirer = {
  prompt,
  createPromptModule,
  Separator: class Separator {},
  registerPrompt: jest.fn(),
  restoreDefaultPrompts: jest.fn(),
};

module.exports = inquirer;
module.exports.default = inquirer;
module.exports.createPromptModule = createPromptModule;
