# 🏗️ Wordom Project Overview

This document provides a comprehensive overview of the Wordom project architecture, design decisions, and technical implementation details.

## 🎯 Project Vision

Wordom is an **AI-powered Wordle Unlimited helper** that combines the power of local AI with browser extension technology to provide:
- **Contextual sentence generation** for word definitions
- **Multi-language translations** with pronunciation
- **Smart word suggestions** based on game state
- **Beautiful, responsive UI** that integrates seamlessly with Wordle

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Experience                         │
├─────────────────────────────────────────────────────────────────┤
│  Wordle Unlimited  ←→  Chrome Extension  ←→  Local AI Server  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   External APIs │
                    │  • Dictionary   │
                    │  • Wiktionary   │
                    │  • Translation  │
                    └─────────────────┘
```

## 🔧 Technology Stack

### Frontend (Browser Extension)
- **Manifest V3** - Modern Chrome extension framework
- **Vanilla JavaScript** - No framework dependencies
- **CSS3** - Modern styling with custom properties
- **DOM Manipulation** - Direct element creation and management

### Backend (Local Server)
- **Node.js 18+** - Modern JavaScript runtime
- **ES Modules** - Using `.mjs` files for native module support
- **HTTP Server** - Built-in `http` module
- **Fetch API** - Modern HTTP client

### AI Integration
- **Ollama** - Local AI model management
- **Llama 3.2** - Primary AI model (3B parameters)
- **Custom Prompts** - Tailored for sentence generation
- **Fallback Systems** - API-based alternatives when AI fails

### External Services
- **Free Dictionary API** - Word definitions and examples
- **Wiktionary** - Additional linguistic data
- **Translation APIs** - Multi-language support

## 📁 Project Structure

```
wordom/
├── src/                    # Backend server code
│   ├── server.mjs         # Main server (ES modules)
│   └── server.js          # Alternative server (CommonJS)
├── extension/              # Browser extension
│   ├── manifest.json       # Extension configuration
│   ├── content.js          # Main extension logic
│   ├── style.css           # Extension styling
│   └── wordomIcon.png      # Extension icon
├── docs/                   # Documentation
│   ├── SETUP.md            # Installation guide
│   └── PROJECT_OVERVIEW.md # This file
├── screenshots/            # Demo images
├── .github/                # GitHub configuration
│   ├── workflows/          # CI/CD pipelines
│   ├── ISSUE_TEMPLATE/     # Issue templates
│   └── pull_request_template.md
├── package.json            # Project metadata
├── LICENSE                 # MIT license
└── README.md               # Project showcase
```

## 🧠 AI Integration Architecture

### Sentence Generation Flow
```
User Request → Extension → Local Server → Ollama API → AI Model → Validation → Response
     │            │            │            │           │         │          │
     │            │            │            │           │         │          └─ Return to User
     │            │            │            │           │         └─ Contextual Validation
     │            │            │            │           └─ Llama 3.2 Model
     │            │            │            └─ HTTP Request
     │            │            └─ Process Request
     │            └─ HTTP Request
     └─ Click "Sentence" Button
```

### AI Prompt Engineering
The system uses carefully crafted prompts to ensure quality output:

```javascript
const prompt = `Create ONE sentence that demonstrates the word "${word}" being used with EXACTLY this meaning: "${definitionText}". 

IMPORTANT: The sentence must be a clear, specific example of this definition in action. Do not use any other meaning of the word.

For example:
- If the definition is about "a portion/part", create a sentence about dividing or allocating parts
- If the definition is about "giving/distributing", create a sentence about sharing or giving things to others  
- If the definition is about "a blade/tool", create a sentence about using that specific tool

Output only the sentence, nothing else.`;
```

### Validation System
AI-generated sentences undergo rigorous validation:

1. **Basic Structure**: Length, punctuation, capitalization
2. **Part of Speech**: Noun/verb usage validation
3. **Contextual Relevance**: Ensures sentence matches definition
4. **Fallback Logic**: API alternatives when AI fails

## 🌐 API Endpoints

### Core Endpoints
- **`/health`** - Server health check
- **`/state`** - Game state management
- **`/define`** - Word definition lookup
- **`/sentence`** - AI sentence generation
- **`/translate`** - Multi-language translation
- **`/suggest`** - Word suggestions
- **`/rerank`** - Suggestion optimization

### Request/Response Patterns
```javascript
// Sentence Generation
GET /sentence?word=crane&definitionIndex=1
Response: {
  word: "crane",
  sentence: "As she struggled to reach the top shelf...",
  definitionIndex: 1,
  definition: { partOfSpeech: "verb", ... }
}

// Translation
GET /translate?word=crane&lang=es&definitions=[...]
Response: {
  translations: [
    {
      word: "grúa",
      pronunciation: "/ɡruːa/",
      definition: "bird of large size with long legs and neck"
    }
  ]
}
```

## 🎨 UI/UX Design Principles

### Design Philosophy
- **Minimalist** - Clean, uncluttered interface
- **Contextual** - Information appears when needed
- **Responsive** - Works on all screen sizes
- **Accessible** - Proper ARIA labels and keyboard navigation

### Color Scheme
- **Primary**: `#3F6C91` (Professional blue)
- **Secondary**: `#f0f0f0` (Light gray)
- **Text**: `#333` (Dark gray)
- **Accent**: `#00ff00` (Green for loading states)

### Loading States
- **Animated progress bars** with realistic AI processing simulation
- **Variable progress increments** based on completion percentage
- **Minimum display time** to ensure visibility
- **Triple-layer CSS enforcement** to override conflicting styles

## 🔒 Security Considerations

### Local-First Architecture
- **No data sent to external servers** (except dictionary APIs)
- **AI processing happens locally** via Ollama
- **User privacy preserved** - no tracking or data collection

### API Security
- **CORS enabled** for local development
- **Input validation** on all endpoints
- **Rate limiting** considerations for production
- **Error handling** without information leakage

## 🚀 Performance Optimization

### AI Response Optimization
- **15-second timeout** for AI calls
- **Fallback systems** for failed requests
- **Caching strategies** for repeated lookups
- **Single definition processing** for faster responses

### Extension Performance
- **Efficient DOM manipulation** with minimal reflows
- **CSS animations** using transform/opacity
- **Lazy loading** of non-critical features
- **Memory management** for long-running sessions

## 🔮 Future Roadmap

### Short-term (Next 3 months)
- [ ] **Enhanced AI models** - Support for more Ollama models
- [ ] **Better validation** - Improved sentence quality
- [ ] **Mobile optimization** - Responsive design improvements
- [ ] **Performance metrics** - Response time monitoring

### Medium-term (3-6 months)
- [ ] **Cloud deployment** - Remove local server dependency
- [ ] **Community models** - Share custom AI models
- [ ] **Plugin system** - Third-party extensions
- [ ] **Advanced analytics** - User behavior insights

### Long-term (6+ months)
- [ ] **Multi-game support** - Other word games beyond Wordle Unlimited
- [ ] **AI training** - Custom model fine-tuning
- [ ] **Collaborative features** - Multi-user experiences
- [ ] **Enterprise features** - Educational institution support

## 🧪 Testing Strategy

### Current Testing
- **Manual testing** on Chrome and Firefox
- **Cross-browser compatibility** verification
- **Error scenario testing** (server down, AI failures)
- **Performance testing** with various AI models

### Future Testing
- **Unit tests** for utility functions
- **Integration tests** for API endpoints
- **End-to-end tests** for complete workflows
- **Performance benchmarks** for optimization

## 📊 Monitoring and Analytics

### Current Monitoring
- **Console logging** with debug information
- **Server health checks** via `/health` endpoint
- **Error tracking** in server logs
- **Performance observation** during development

### Future Monitoring
- **Application performance monitoring** (APM)
- **Error tracking services** (Sentry, LogRocket)
- **User analytics** (privacy-focused)
- **Performance metrics** (Core Web Vitals)

## 🤝 Contributing Guidelines

### Code Standards
- **ES6+ features** when possible
- **Consistent naming** conventions
- **JSDoc documentation** for complex functions
- **Error handling** for all async operations

### Development Workflow
1. **Fork the repository**
2. **Create feature branch**
3. **Make changes** with tests
4. **Submit pull request**
5. **Code review** and iteration
6. **Merge to main**

## 📚 Resources and References

### Documentation
- [Chrome Extension Development](https://developer.chrome.com/docs/extensions/)
- [Node.js HTTP Module](https://nodejs.org/api/http.html)
- [Ollama Documentation](https://ollama.ai/docs)
- [Manifest V3 Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)

### Community
- [GitHub Issues](https://github.com/nachoj444/wordom/issues)
- [GitHub Discussions](https://github.com/nachoj444/wordom/discussions)
- [Contributing Guide](CONTRIBUTING.md)

---

**This document is a living guide that will be updated as the project evolves. For questions or suggestions, please open an issue or discussion on GitHub.** 🚀
