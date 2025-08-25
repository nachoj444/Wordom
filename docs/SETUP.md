# 🚀 Wordom Setup Guide

This guide will walk you through setting up Wordom on your system. Follow each step carefully to ensure everything works correctly.

## 📋 Prerequisites

Before you begin, make sure you have the following installed:

### 1. **Node.js 18+**
- **Download**: [https://nodejs.org/](https://nodejs.org/)
- **Verify**: Run `node --version` in terminal
- **Required**: Version 18.0.0 or higher

### 2. **Ollama**
- **Download**: [https://ollama.ai/](https://ollama.ai/)
- **Install**: Follow the installation guide for your OS
- **Verify**: Run `ollama --version` in terminal

### 3. **Chrome or Firefox Browser**
- **Chrome**: [https://www.google.com/chrome/](https://www.google.com/chrome/)
- **Firefox**: [https://www.mozilla.org/firefox/](https://www.mozilla.org/firefox/)

## 🔧 Installation Steps

### Step 1: Clone the Repository

```bash
# Clone the repository
git clone https://github.com/nachoj444/wordom.git

# Navigate to the project directory
cd wordom
```

### Step 2: Install Dependencies

```bash
# Install Node.js dependencies
npm install
```

### Step 3: Download AI Model

```bash
# Download the recommended AI model
ollama pull llama3.2:3b

# Alternative models you can try:
# ollama pull llama3.2:8b    # Larger, more capable model
# ollama pull mistral:7b      # Fast, efficient model
# ollama pull codellama:7b    # Good for technical content
```

### Step 4: Start the Server

```bash
# Start the Wordom server
npm start
```

You should see output like:
```
🚀 Starting Wordle MCP Bridge Server on port 8787
```

**Keep this terminal window open!** The server needs to keep running.

### Step 5: Load the Browser Extension

#### For Chrome:
1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **"Load unpacked"**
4. Select the `extension` folder from your Wordom directory
5. The extension should now appear in your extensions list

#### For Firefox:
1. Open Firefox and go to `about:debugging`
2. Click **"This Firefox"**
3. Click **"Load Temporary Add-on"**
4. Select any file from the `extension` folder
5. The extension should now appear in your add-ons

### Step 6: Test the Extension

1. Navigate to [Wordle Unlimited](https://wordleunlimited.org/)
2. Look for the **Wordom icon** in your browser toolbar
3. Click it to open the Wordom popup
4. Try looking up a word to test the connection

## ⚙️ Configuration

### Environment Variables

You can customize Wordom's behavior by setting environment variables:

```bash
# Set your preferred AI model
export OLLAMA_MODEL=llama3.2:3b

# Change the server port (if 8787 is occupied)
export BRIDGE_PORT=8788

# Start the server with custom settings
npm start
```

### Custom AI Models

Wordom works with any Ollama model. Here are some recommendations:

| Model | Size | Speed | Quality | Use Case |
|-------|------|-------|---------|----------|
| `llama3.2:3b` | 3B | Fast | Good | **Recommended for most users** |
| `llama3.2:8b` | 8B | Medium | Better | Better sentence quality |
| `mistral:7b` | 7B | Fast | Good | Good balance of speed/quality |
| `codellama:7b` | 7B | Medium | Good | Technical content |

## 🔍 Troubleshooting

### Common Issues and Solutions

#### 1. **Server Won't Start**
```bash
# Check if port 8787 is already in use
lsof -i:8787

# Kill any process using the port
lsof -ti:8787 | xargs kill -9

# Try a different port
export BRIDGE_PORT=8788
npm start
```

#### 2. **Extension Not Loading**
- Make sure Developer mode is enabled
- Try reloading the extension
- Check the browser console for errors
- Verify the extension folder path is correct

#### 3. **AI Sentences Not Working**
```bash
# Check if Ollama is running
ollama list

# Test Ollama directly
ollama run llama3.2:3b "Hello, how are you?"

# Restart Ollama service
ollama serve
```

#### 4. **Connection Errors**
- Ensure the server is running (`npm start`)
- Check that the extension is calling `localhost:8787`
- Verify no firewall is blocking the connection
- Try refreshing the Wordle page

#### 5. **Slow AI Responses**
- Use a smaller model: `ollama pull llama3.2:3b`
- Close other applications to free up memory
- Consider upgrading your hardware
- Use SSD storage for better performance

### Debug Mode

Enable debug logging to see what's happening:

```bash
# Set debug environment variable
export DEBUG=wordom:*

# Start server with debug logging
npm start
```

## 📱 Browser-Specific Setup

### Chrome
- **Developer Mode**: Required for loading unpacked extensions
- **Security**: May show warnings about localhost connections
- **Updates**: Extension needs to be reloaded after code changes

### Firefox
- **Temporary Add-ons**: Extensions are removed after browser restart
- **Security**: More permissive with localhost connections
- **Performance**: Generally faster than Chrome for extensions

## 🚀 Advanced Configuration

### Custom AI Prompts

You can modify the AI prompts in `src/server.mjs`:

```javascript
// Find this section in the code
const prompt = `Create ONE sentence that demonstrates the word "${word}" being used with EXACTLY this meaning: "${definitionText}". \n\nIMPORTANT: The sentence must be a clear, specific example of this definition in action. Do not use any other meaning of the word.\n\nOutput only the sentence, nothing else.`;

// Modify the prompt to change AI behavior
```

### Custom Styling

Modify the extension appearance in `extension/style.css`:

```css
/* Change the main color scheme */
:root {
  --primary-color: #3F6C91;
  --secondary-color: #f0f0f0;
  --text-color: #333;
}
```

### Server Customization

Modify server behavior in `src/server.mjs`:

```javascript
// Change timeout values
const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds

// Modify validation rules
function isValidContextualSentence(sentence, word, definition, partOfSpeech) {
  // Custom validation logic
}
```

## 📞 Getting Help

If you're still having issues:

1. **Check the logs** in your terminal where `npm start` is running
2. **Search existing issues** on [GitHub](https://github.com/nachoj444/wordom/issues)
3. **Create a new issue** with detailed error information
4. **Join discussions** on [GitHub Discussions](https://github.com/nachoj444/wordom/discussions)

### When Reporting Issues

Please include:
- **Operating System**: Windows, macOS, Linux
- **Node.js Version**: `node --version`
- **Ollama Version**: `ollama --version`
- **Browser**: Chrome/Firefox version
- **Error Messages**: Copy the exact error text
- **Steps to Reproduce**: What you did when the error occurred

## 🎉 Success!

Once everything is working, you should be able to:
- ✅ Look up word definitions
- ✅ Generate AI-powered example sentences
- ✅ Translate words to multiple languages
- ✅ Get smart word suggestions
- ✅ Enjoy beautiful loading animations

**Happy Wordle Unlimited with AI assistance!** 🚀🧠
