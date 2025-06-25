# Contributing to Swarm Manager

Thank you for your interest in contributing to Swarm Manager! We welcome contributions from everyone.

## 🚀 Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/swarm-manager.git
   cd swarm-manager
   ```
3. **Create a new branch** for your feature or bugfix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 🛠️ Development Setup

### Prerequisites

- Docker Engine 20.10+ with Swarm mode
- Go 1.21+
- Node.js 18+
- npm or yarn

### Backend Development

```bash
cd backend
go mod download
go run main.go
```

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

## 📝 Making Changes

### Code Style

- **Go**: Follow standard Go conventions, use `gofmt`
- **TypeScript/React**: Use ESLint and Prettier configurations
- **Commits**: Use conventional commit messages

### Testing

```bash
# Backend tests
cd backend
go test ./...

# Frontend tests
cd frontend
npm test
```

### Build & Verify

```bash
# Test the full Docker build
docker build -t swarm-manager-test .
```

## 🔄 Submitting Changes

1. **Commit your changes** with descriptive messages:

   ```bash
   git commit -m "feat: add real-time service monitoring"
   ```

2. **Push to your fork**:

   ```bash
   git push origin feature/your-feature-name
   ```

3. **Create a Pull Request** on GitHub with:
   - Clear description of changes
   - Screenshots for UI changes
   - Test results
   - Breaking changes noted

## 🐛 Reporting Issues

When reporting issues, please include:

- OS and Docker version
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs or screenshots

## 💡 Feature Requests

We welcome feature requests! Please:

- Check existing issues first
- Describe the use case clearly
- Explain why it would be valuable
- Consider implementation complexity

## 📋 Code Review Process

1. All submissions require review
2. Maintainers will provide feedback
3. Address feedback and update PR
4. Once approved, changes will be merged

## 🎯 Priority Areas

We're especially interested in contributions for:

- Performance improvements
- Additional Docker Swarm features
- UI/UX enhancements
- Documentation improvements
- Test coverage

## 📞 Getting Help

- 💬 [GitHub Discussions](https://github.com/Affell/swarm-manager/discussions)
- 🐛 [GitHub Issues](https://github.com/Affell/swarm-manager/issues)
- 📧 Email: [support@affell.fr](mailto:support@affell.fr)

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thanks for contributing! 🙏
