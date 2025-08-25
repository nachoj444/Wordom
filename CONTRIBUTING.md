# 🤝 Contributing to Wordom

Thank you for your interest in contributing to Wordom! This document provides guidelines and information for contributors.

## 🎯 How to Contribute

There are many ways you can contribute to Wordom:

### 🐛 **Report Bugs**
- Use the [GitHub Issues](https://github.com/nachoj444/wordom/issues) page
- Include detailed steps to reproduce the bug
- Provide your system information (OS, browser, versions)
- Include error messages and screenshots if possible

### 💡 **Suggest Features**
- Open a [GitHub Discussion](https://github.com/nachoj444/wordom/discussions)
- Describe the feature you'd like to see
- Explain why it would be useful
- Consider implementation complexity

### 🔧 **Fix Issues**
- Look for issues labeled "good first issue" or "help wanted"
- Comment on the issue to let others know you're working on it
- Submit a pull request with your fix

### 📚 **Improve Documentation**
- Fix typos or unclear explanations
- Add examples or screenshots
- Improve setup instructions
- Translate documentation to other languages

### 🎨 **Enhance the UI/UX**
- Improve the visual design
- Make the interface more intuitive
- Add accessibility features
- Optimize for mobile devices

## 🚀 Development Setup

### Prerequisites
- Node.js 18+
- Git
- Ollama (for AI features)
- Chrome/Firefox for testing

### Getting Started

```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/YOUR_USERNAME/wordom.git
cd wordom

# Add the original repository as upstream
git remote add upstream https://github.com/nachoj444/wordom.git

# Install dependencies
npm install

# Start the development server
npm start

# Load the extension in your browser for testing
```

### Development Workflow

```bash
# Create a new branch for your changes
git checkout -b feature/your-feature-name

# Make your changes
# Test thoroughly

# Commit your changes
git add .
git commit -m "feat: add new feature description"

# Push to your fork
git push origin feature/your-feature-name

# Create a pull request on GitHub
```

## 📝 Code Style Guidelines

### JavaScript/Node.js
- Use **ES6+** features when possible
- Follow **consistent naming conventions**
- Add **JSDoc comments** for complex functions
- Use **async/await** instead of callbacks
- Handle **errors gracefully**

### CSS
- Use **CSS custom properties** for theming
- Follow **BEM methodology** for class naming
- Keep **selectors specific** and avoid deep nesting
- Use **flexbox/grid** for layouts
- Ensure **responsive design**

### HTML
- Use **semantic HTML** elements
- Include **proper ARIA labels** for accessibility
- Keep **markup clean** and minimal
- Use **data attributes** for JavaScript hooks

### Git Commits
Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```bash
# Format: type(scope): description
git commit -m "feat(ui): add dark mode toggle"
git commit -m "fix(server): resolve timeout issues with AI calls"
git commit -m "docs(readme): update installation instructions"
git commit -m "style(css): improve button hover effects"
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## 🧪 Testing

### Manual Testing
- Test on **multiple browsers** (Chrome, Firefox, Edge)
- Test on **different screen sizes** (desktop, tablet, mobile)
- Test with **various AI models** (different Ollama models)
- Test **error scenarios** (server down, network issues)

### Automated Testing (Future)
- Unit tests for utility functions
- Integration tests for API endpoints
- End-to-end tests for extension functionality
- Performance tests for AI response times

## 📋 Pull Request Guidelines

### Before Submitting
- [ ] **Test your changes** thoroughly
- [ ] **Update documentation** if needed
- [ ] **Follow code style** guidelines
- [ ] **Write clear commit messages**
- [ ] **Include screenshots** for UI changes

### Pull Request Template
```markdown
## Description
Brief description of what this PR accomplishes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] UI/UX improvement
- [ ] Performance optimization

## Testing
- [ ] Tested on Chrome
- [ ] Tested on Firefox
- [ ] Tested with different AI models
- [ ] Tested error scenarios

## Screenshots
Include screenshots for UI changes.

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No console errors
```

## 🏷️ Issue Labels

We use labels to categorize issues:

- **bug** - Something isn't working
- **enhancement** - New feature or request
- **documentation** - Improvements to docs
- **good first issue** - Good for newcomers
- **help wanted** - Extra attention needed
- **priority: high** - Important to fix soon
- **priority: low** - Nice to have
- **ui/ux** - User interface improvements

## 🚫 What Not to Do

- **Don't submit** incomplete or broken code
- **Don't ignore** code review feedback
- **Don't commit** directly to main branch
- **Don't submit** PRs without testing
- **Don't ignore** existing code style
- **Don't submit** large changes without discussion

## 📞 Getting Help

### Questions?
- **GitHub Discussions**: [Ask questions here](https://github.com/nachoj444/wordom/discussions)
- **GitHub Issues**: [Report problems here](https://github.com/nachoj444/wordom/issues)
- **Code Review**: Ask for help in your PR

### Resources
- [GitHub Flow](https://guides.github.com/introduction/flow/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Chrome Extension Development](https://developer.chrome.com/docs/extensions/)

## 🎉 Recognition

Contributors will be recognized in:
- **README.md** - List of contributors
- **Release notes** - Credit for significant contributions
- **GitHub profile** - Contribution graph and activity

## 📄 License

By contributing to Wordom, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

**Thank you for helping make Wordom better for the Wordle Unlimited community!** 🚀🧠

If you have any questions about contributing, feel free to ask in [GitHub Discussions](https://github.com/nachoj444/wordom/discussions).
