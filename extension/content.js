(() => {
  const BRIDGE = 'http://127.0.0.1:8787';
  // Always use AI (Ollama) for suggestions each turn
  const FORCE_AI = true;

  function h(tag, props = {}, ...children) {
    const el = document.createElement(tag);
    Object.assign(el.style, props.style || {});
    for (const [k, v] of Object.entries(props)) {
      if (k === 'style') continue;
      el[k] = v;
    }
    children.forEach(c => el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return el;
  }

  function createPanel() {
    const panel = document.createElement('div');
    panel.id = 'wordle-helper-panel';
        panel.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 380px;
      min-width: 320px;
      max-width: 600px;
      min-height: 200px;
      max-height: 80vh;
      background: #0d1117;
      border: 1px solid #21262d;
      border-radius: 12px;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 400;
      line-height: 1.5;
      z-index: 10000;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      resize: both;
      overflow: auto;
      display: flex;
      flex-direction: column;
    `;
    
    // Add resize handle indicator
    const resizeHandle = document.createElement('div');
    resizeHandle.style.cssText = `
      position: absolute;
      bottom: 0;
      right: 0;
      width: 20px;
      height: 20px;
      cursor: se-resize;
      background: linear-gradient(135deg, transparent 0%, transparent 50%, #666 50%, #666 100%);
      border-radius: 0 0 8px 0;
      transition: background 0.2s ease;
    `;
    
    // Add hover effect for resize handle
    resizeHandle.addEventListener('mouseenter', () => {
      resizeHandle.style.background = 'linear-gradient(135deg, transparent 0%, transparent 50%, #999 50%, #999 100%)';
    });
    
    resizeHandle.addEventListener('mouseleave', () => {
      resizeHandle.style.background = 'linear-gradient(135deg, transparent 0%, transparent 50%, #666 50%, #666 100%)';
    });
    
    panel.appendChild(resizeHandle);
    
    // Add drag handle at the top
    const dragHandle = document.createElement('div');
    dragHandle.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 48px;
      background: #3F6C91;
      border-radius: 12px 12px 0 0;
      cursor: move;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      color: #ffffff;
      user-select: none;
      font-size: 16px;
      letter-spacing: 0.3px;
    `;
    // Create icon and title container
    const titleContainer = document.createElement('div');
    titleContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';
    
      // Add the icon - use your custom PNG
  const icon = document.createElement('img');
  icon.src = chrome.runtime.getURL('wordomIcon.png');
  icon.style.cssText = 'width: 20px; height: 20px; object-fit: contain;';
  icon.alt = 'Wordom Icon';
  
  // Add error handling to debug icon loading
  icon.onerror = () => {
    // Remove the broken image
    icon.remove();
  };
  
  titleContainer.appendChild(icon);
  
  
  // Add the title text
    const titleText = document.createElement('span');
    titleText.textContent = 'Wordom';
    titleContainer.appendChild(titleText);
    
    dragHandle.appendChild(titleContainer);
    panel.appendChild(dragHandle);
    
    // Add drag and resize functionality
    let isDragging = false;
    let isResizing = false;
    let startX, startY, startWidth, startHeight, startLeft, startTop;
    
    // Drag functionality
    dragHandle.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseInt(panel.style.left) || 0;
      startTop = parseInt(panel.style.top) || 0;
      e.preventDefault();
    });
    
    // Resize functionality
    resizeHandle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startWidth = panel.offsetWidth;
      startHeight = panel.offsetHeight;
      e.preventDefault();
    });
    
    // Global mouse move and up events
    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        panel.style.left = (startLeft + deltaX) + 'px';
        panel.style.top = (startTop + deltaY) + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
      }
      
      if (isResizing) {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        const newWidth = Math.max(300, Math.min(600, startWidth + deltaX));
        const newHeight = Math.max(200, Math.min(window.innerHeight * 0.8, startHeight + deltaY));
        panel.style.width = newWidth + 'px';
        panel.style.height = newHeight + 'px';
      }
    });
    
    document.addEventListener('mouseup', () => {
      isDragging = false;
      isResizing = false;
    });

    // Remove the duplicate header - we only want the gradient top bar
    // const header = h('div', { style: { display: 'flex', alignItems: 'center', marginBottom: '20px', gap: '12px' } },
    //   h('div', { style: { fontWeight: 700, fontSize: '20px', color: '#1a1a1a', letterSpacing: '-0.5px' } }, 'Wordle Wisdom'),
    //   h('div', { style: { marginLeft: 'auto', fontSize: '13px', color: '#6c757d', fontWeight: '500', padding: '6px 12px', background: '#e9ecef', borderRadius: '20px' } }, 'Auto-updating')
    // );
    
    // Add margin-top to account for drag handle
    // header.style.marginTop = '65px';
    // header.style.padding = '0 24px';
    // On-board guesses section
    const historyTitle = h('div', { id: 'wordle-history-title', style: { marginTop: '16px', marginBottom: '12px', fontSize: '13px', color: '#3F6C91', fontWeight: '600', display: 'none', paddingTop: '8px', textTransform: 'uppercase', letterSpacing: '1px' } }, 'Past Guesses');
    const history = h('div', { id: 'wordle-history-list', style: { display: 'grid', gap: '8px', marginBottom: '8px' } });
    const list = h('div', { style: { display: 'grid', gap: '8px' } });
    const suggestTitle = h('div', { id: 'wordle-suggest-title', style: { marginTop: '16px', marginBottom: '12px', fontSize: '13px', color: '#3F6C91', fontWeight: '600', paddingTop: '8px', textTransform: 'uppercase', letterSpacing: '1px' } }, 'Suggestions');
    const defWrap = h('div', { id: 'wordle-def-wrap', style: { marginTop: '6px', display: 'none', flex: '1', minHeight: '0', overflow: 'hidden' } });
    const contentBox = h('div', { id: 'wordle-content-box', style: { fontSize: '13px', lineHeight: '1.6', height: 'auto', minHeight: '0', overflowY: 'visible', paddingTop: '8px', paddingRight: '20px', flex: '1' } });
    defWrap.appendChild(contentBox);

    // Create resizable divider between suggestions and definitions
    const divider = document.createElement('div');
    divider.id = 'wordle-divider';
    divider.style.cssText = `
      height: 1px;
      background: #21262d;
      cursor: ns-resize;
      margin: 16px 0;
      position: relative;
      transition: all 0.2s ease;
    `;
    
    // Add visual indicator for the divider
    const dividerHandle = document.createElement('div');
    dividerHandle.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 24px;
      height: 3px;
              background: #3F6C91;
      border-radius: 2px;
    `;
    divider.appendChild(dividerHandle);
    
    // Add hover effect
    divider.addEventListener('mouseenter', () => {
      divider.style.background = '#30363d';
      dividerHandle.style.background = '#3F6C91';
    });
    
    divider.addEventListener('mouseleave', () => {
      divider.style.background = '#21262d';
      dividerHandle.style.background = '#3F6C91';
    });
    
    // Add drag functionality for the divider
    let isDividerDragging = false;
    let dividerStartY, dividerStartSuggestionsHeight;
    
    // Set initial heights after elements are created
    setTimeout(() => {
      list.style.height = '200px';
      list.style.overflowY = 'auto';
      defWrap.style.height = '300px';
      defWrap.style.overflowY = 'auto';
    }, 100);
    
    divider.addEventListener('mousedown', (e) => {
      isDividerDragging = true;
      dividerStartY = e.clientY;
      dividerStartSuggestionsHeight = parseInt(list.style.height) || 200;
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (isDividerDragging) {
        try {
          const deltaY = e.clientY - dividerStartY;
          const newSuggestionsHeight = Math.max(100, Math.min(400, dividerStartSuggestionsHeight + deltaY));
          
          // Update suggestions height
          if (list && list.style) {
            list.style.height = newSuggestionsHeight + 'px';
          }
          
          // Update definitions height to fill remaining space
          if (panel && defWrap) {
            const panelHeight = panel.offsetHeight || 0;
            const dragHandleHeight = dragHandle ? dragHandle.offsetHeight || 0 : 0;
            const historyHeight = history ? history.offsetHeight || 0 : 0;
            const suggestTitleHeight = suggestTitle ? suggestTitle.offsetHeight || 0 : 0;
            const dividerHeight = divider ? divider.offsetHeight || 0 : 0;
            
            const availableHeight = panelHeight - dragHandleHeight - historyHeight - suggestTitleHeight - dividerHeight - 20; // 20px for margins
            const newDefinitionsHeight = Math.max(200, availableHeight - newSuggestionsHeight);
            
            defWrap.style.height = newDefinitionsHeight + 'px';
          }
        } catch (error) {
          console.error('Error in divider drag:', error);
          isDividerDragging = false;
        }
      }
    });
    
    document.addEventListener('mouseup', () => {
      isDividerDragging = false;
    });
    
    // Append all content to the panel
    // panel.appendChild(header); // Removed duplicate header
    panel.appendChild(historyTitle);
    panel.appendChild(history);
    panel.appendChild(suggestTitle);
    panel.appendChild(list);
    panel.appendChild(divider);
    panel.appendChild(defWrap);

    
    document.body.appendChild(panel);
    return { panel, list, history, historyTitle };
  }
  async function fetchDefinition(word) {
    try {
            const response = await fetch(`http://127.0.0.1:8787/define?word=${word}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      if (data.definitions && data.definitions.length > 0) {
        const wrap = document.getElementById('wordle-def-wrap');
        if (wrap) wrap.style.display = 'block';
        
        const box = document.getElementById('wordle-content-box');
        if (!box) {
          return;
        }
        
        // Store definitions globally so sentence function can access them
        window.currentWordDefinitions = data.definitions;
        
        box.innerHTML = '';
        
        // Add Definition section header
        const defHeader = document.createElement('div');
        defHeader.style.cssText = 'font-weight: 700; margin-bottom: 16px; color: #3F6C91; border-bottom: 1px solid #30363d; padding-bottom: 8px; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px;';
        defHeader.textContent = word.toUpperCase();
        box.appendChild(defHeader);
        
        const ul = document.createElement('ul');
        ul.style.margin = '0';
        ul.style.paddingLeft = '20px';
        
        data.definitions.forEach((def, index) => {
          const li = document.createElement('li');
          li.style.marginBottom = '8px';
          
          // Add Definition subtitle
          const defSubtitle = document.createElement('div');
                      defSubtitle.style.cssText = 'font-weight: 600; margin-bottom: 8px; color: #3F6C91; font-size: 14px;';
          defSubtitle.textContent = `Definition ${index + 1}:`;
          li.appendChild(defSubtitle);
          
          // Handle both object format {partOfSpeech, definition} and string format
          let definitionText, partOfSpeech;
          if (typeof def === 'object' && def.definition) {
            definitionText = def.definition;
            partOfSpeech = def.partOfSpeech || '';
          } else if (typeof def === 'string') {
            definitionText = def;
            partOfSpeech = '';
          } else {
            definitionText = String(def);
            partOfSpeech = '';
          }
          
          // Try to extract part of speech from the definition text if not provided
          if (!partOfSpeech) {
            if (definitionText.includes('noun')) partOfSpeech = 'Noun';
            else if (definitionText.includes('verb')) partOfSpeech = 'Verb';
            else if (definitionText.includes('adjective')) partOfSpeech = 'Adjective';
            else if (definitionText.includes('adverb')) partOfSpeech = 'Adverb';
          }
          
          if (partOfSpeech) {
            const partOfSpeechSpan = document.createElement('span');
            partOfSpeechSpan.innerHTML = `<strong style="color: #ffffff;">${partOfSpeech}:</strong> ${definitionText}`;
            li.appendChild(partOfSpeechSpan);
          } else {
            const textSpan = document.createElement('span');
            textSpan.textContent = definitionText;
            li.appendChild(textSpan);
          }
          
          // Add pronunciation display if available
          if (def.pronunciation || def.audio) {
            const pronunciationDiv = document.createElement('div');
            pronunciationDiv.style.cssText = 'margin-left: 20px; margin-top: 4px; display: flex; align-items: center; gap: 8px;';
            
            // Pronunciation text
            if (def.pronunciation) {
              const phoneticText = document.createElement('span');
              phoneticText.style.cssText = 'color: #ffffff; font-family: monospace; font-size: 11px;';
              phoneticText.textContent = def.pronunciation;
              pronunciationDiv.appendChild(phoneticText);
            }
            
            // Audio play button
            if (def.audio) {
              const playButton = document.createElement('button');
              playButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: #ffffff;"><g data-name="high audio"><path d="M11.46 3c-1 0-1 .13-6.76 4H1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3.7l5.36 3.57A2.54 2.54 0 0 0 14 18.46V5.54A2.54 2.54 0 0 0 11.46 3zM2 9h2v6H2zm10 9.46a.55.55 0 0 1-.83.45L6 15.46V8.54l5.17-3.45a.55.55 0 0 1 .83.45zM16.83 9.17a1 1 0 0 0-1.42 1.42 2 2 0 0 1 0 2.82 1 1 0 0 0 .71 1.71c1.38 0 3.04-3.62.71-5.95z"/><path d="M19 7.05a1 1 0 0 0-1.41 1.41 5 5 0 0 1 0 7.08 1 1 0 0 0 .7 1.7c1.61 0 4.8-6.05.71-10.19z"/><path d="M21.07 4.93a1 1 0 0 0-1.41 1.41 8 8 0 0 1 0 11.32 1 1 0 0 0 1.41 1.41 10 10 0 0 0 0-14.14z"/></g></svg>';
                              playButton.style.cssText = 'background: #3F6C91; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 10px; color: white; display: flex; align-items: center; justify-content: center;';
              playButton.onclick = () => playPronunciation(def.audio, def.pronunciation || '');
              pronunciationDiv.appendChild(playButton);
            }
            
            li.appendChild(pronunciationDiv);
          }
          
          ul.appendChild(li);
          
          // Add a placeholder for the sentence below each definition (hidden initially)
          const sentencePlaceholder = document.createElement('div');
          sentencePlaceholder.id = `sentence-${index}`;
          sentencePlaceholder.style.cssText = 'margin-left: 20px; margin-bottom: 12px; display: none;';
          li.appendChild(sentencePlaceholder);
          
          // Add a placeholder for the translation below each sentence (hidden initially)
          const translationPlaceholder = document.createElement('div');
          translationPlaceholder.id = `translation-${index}`;
          translationPlaceholder.style.cssText = 'margin-left: 20px; margin-bottom: 12px; display: none;';
          li.appendChild(translationPlaceholder);
        });
        
        box.appendChild(ul);
        
        // Add close button
        const closeBtn = document.createElement('span');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = 'position: absolute; top: 12px; right: 12px; cursor: pointer; font-size: 20px; color: #7d8590; font-weight: 300; transition: all 0.2s ease;';
        closeBtn.onclick = () => {
          const wrap = document.getElementById('wordle-def-wrap');
          box.innerHTML = '';
          if (wrap && areAllSectionsEmpty()) {
            wrap.style.display = 'none';
          }
        };
        
        // Add hover effects to close button
        closeBtn.addEventListener('mouseenter', () => {
          closeBtn.style.color = '#f85149';
        });
        closeBtn.addEventListener('mouseleave', () => {
          closeBtn.style.color = '#7d8590';
        });
        
        box.style.position = 'relative';
        box.appendChild(closeBtn);
        
        // Add individual Sentence and Translate buttons for each definition
        data.definitions.forEach((def, index) => {
          const defButtons = document.createElement('div');
          defButtons.style.cssText = 'margin-left: 20px; margin-top: 8px; display: flex; gap: 8px;';
          
          // Sentence button for this definition
          const sentenceBtn = document.createElement('button');
          sentenceBtn.textContent = 'Sentence';
                      sentenceBtn.style.cssText = 'background: #3F6C91; color: #fff; border: none; border-radius: 6px; padding: 6px 12px; font-size: 12px; cursor: pointer; font-weight: 500; transition: all 0.2s ease;';
          sentenceBtn.onclick = () => fetchSentenceForDefinition(word, index);
          
          // Translate button for this definition
          const translateBtn = document.createElement('button');
          translateBtn.textContent = 'Translate';
                      translateBtn.style.cssText = 'background: #3F6C91; color: #fff; border: none; border-radius: 6px; padding: 6px 12px; font-size: 12px; cursor: pointer; font-weight: 500; transition: all 0.2s ease;';
          translateBtn.onclick = () => showTranslateDropdownForDefinition(word, index);
          
          // Add hover effects to sentence button
          sentenceBtn.addEventListener('mouseenter', (e) => {
            e.target.style.background = '#58a6ff';
          });
          sentenceBtn.addEventListener('mouseleave', (e) => {
            e.target.style.background = '#3F6C91';
          });
          
          // Add hover effects to translate button
          translateBtn.addEventListener('mouseenter', (e) => {
            e.target.style.background = '#58a6ff';
          });
          translateBtn.addEventListener('mouseleave', (e) => {
            e.target.style.background = '#3F6C91';
          });
          
          defButtons.appendChild(sentenceBtn);
          defButtons.appendChild(translateBtn);
          
          // Find the current list item and add buttons to it
          const currentLi = ul.children[index];
          if (currentLi) {
            currentLi.appendChild(defButtons);
          } else {
            console.warn(`Could not find list item at index ${index}`);
          }
        });
        // Definition display completed successfully
      } else {
        // No definition found for word
      }
    } catch (error) {
      console.error('Couldn\'t fetch definition:', error);
    }
  }

  async function fetchSentence(word) {
            // Fetching sentences for word
    let box;
    try {
      const wrap = document.getElementById('wordle-def-wrap');
      if (wrap) wrap.style.display = 'block';
      
      box = document.getElementById('wordle-content-box');
      if (!box) {
        return;
      }
      
      const response = await fetch(`http://127.0.0.1:8787/sentence?word=${word}`);
      
      // Show loading message in the fixed bottom section
      const bottomSection = document.getElementById('wordle-bottom-section');
      let loadingFill = null;
      let loadingInterval = null;
      
      if (bottomSection) {
        const loadingMsg = document.createElement('div');
        loadingMsg.id = 'sentence-loading';
        loadingMsg.style.cssText = 'margin-top: 12px; margin-bottom: 8px; font-style: italic; color: #ffffff; text-align: center; font-weight: 600; font-size: 16px;';
        loadingMsg.textContent = '🔍 Looking up sentences...';
        bottomSection.appendChild(loadingMsg);
        
        // Add simple blue loading bar
        const loadingBar = document.createElement('div');
        loadingBar.id = 'sentence-loading-bar';
        loadingBar.style.cssText = 'width: 100%; height: 16px; background: #e0e0e0; margin: 12px 0; border-radius: 8px; overflow: hidden; border: 2px solid #3F6C91;';
        loadingFill = document.createElement('div');
        loadingFill.style.cssText = 'height: 100%; background: #3F6C91; width: 0%; transition: width 0.2s ease; border-radius: 6px;';
        loadingBar.appendChild(loadingFill);
        bottomSection.appendChild(loadingBar);
        
        // Simple loading animation with minimum display time
        let progress = 0;
        loadingInterval = setInterval(() => {
          progress += 3;
          if (progress > 95) progress = 95;
          if (loadingFill) {
            loadingFill.style.width = progress + '%';
          }
        }, 40);
        
        // Force minimum display time of 800ms
        setTimeout(() => {
          if (loadingFill) {
            loadingFill.style.width = '100%';
          }
        }, 800);
      }
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      // Clean up loading interval and complete animation
      if (loadingInterval) {
        clearInterval(loadingInterval);
      }
      if (loadingFill) {
        loadingFill.style.width = '100%';
      }
      
              // Remove only sentence-specific loading elements
        const sentenceLoadingElements = box.querySelectorAll('#sentence-loading');
        sentenceLoadingElements.forEach(el => el.remove());
        
        const bottomSectionForCleanup = document.getElementById('wordle-bottom-section');
        if (bottomSectionForCleanup) {
          const sentenceLoadingElements = bottomSectionForCleanup.querySelectorAll('#sentence-loading');
          sentenceLoadingElements.forEach(el => el.remove());
          
          // Remove sentence loading bars specifically
          const sentenceLoadingBar = bottomSectionForCleanup.querySelector('#sentence-loading-bar');
          if (sentenceLoadingBar) sentenceLoadingBar.remove();
        }
      
      if (data.sentences && data.sentences.length > 0) {
        // Get the definitions from the sentence response (they should match 1:1)
        const definitions = data.definitions || window.currentWordDefinitions || [];
        
        // Populate each sentence placeholder below its corresponding definition
        data.sentences.forEach((sentence, index) => {
          const sentencePlaceholder = document.getElementById(`sentence-${index}`);
          if (sentencePlaceholder) {
            sentencePlaceholder.style.cssText = 'margin-left: 20px; margin-bottom: 12px; color: #ffffff;';
            
            // If we have definitions, show which definition this sentence relates to
            if (definitions[index]) {
              let defType = 'Word';
              const def = definitions[index];
              
              // Handle both object format {partOfSpeech, definition} and string format
              if (typeof def === 'object' && def.partOfSpeech) {
                defType = def.partOfSpeech.charAt(0).toUpperCase() + def.partOfSpeech.slice(1);
              } else if (typeof def === 'string') {
                if (def.includes('noun')) defType = 'Noun';
                else if (def.includes('verb')) defType = 'Verb';
                else if (def.includes('adjective')) defType = 'Adjective';
                else if (def.includes('adverb')) defType = 'Adverb';
              }
              
              sentencePlaceholder.innerHTML = `<div style="color: #3F6C91; font-weight: 600; margin-bottom: 4px;">Sentence Example:</div><strong style="color: #ffffff;">${defType}:</strong> ${sentence}`;
            } else {
              sentencePlaceholder.textContent = sentence;
            }
          }
        });
        
        // Sentence display completed successfully
      } else {
        // Show error message in the first sentence placeholder
        const firstPlaceholder = document.getElementById('sentence-0');
        if (firstPlaceholder) {
          firstPlaceholder.style.cssText = 'margin-left: 20px; margin-bottom: 12px; color: #ffffff; font-style: italic;';
          firstPlaceholder.textContent = 'No example sentences found.';
        }
      }
    } catch (error) {
      console.error('Couldn\'t fetch sentences:', error);
      if (box) {
        box.innerHTML = 'Couldn\'t fetch sentences.';
      }
    }
  }

  function areAllSectionsEmpty() {
    const defs = document.getElementById('wordle-content-box');
    // Check if the content box is empty
    return (!defs || !defs.textContent.trim());
  }

  function showTranslateDropdown(word) {
    const wrap = document.getElementById('wordle-def-wrap');
    if (wrap) wrap.style.display = 'block';
    
    const box = document.getElementById('wordle-content-box');
    if (!box) return;
    
    // Add translation dropdown below the existing content
    const translationSection = document.createElement('div');
    translationSection.id = 'translation-section';
    translationSection.style.cssText = 'margin-top: 12px; padding: 8px; background: #1a1a1a; border-radius: 4px;';
    
    // Language selection dropdown
    const languages = [
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ru', name: 'Russian' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'zh', name: 'Chinese' },
      { code: 'ar', name: 'Arabic' }
    ];
    
    const selectContainer = h('div', { style: { marginBottom: '12px' } });
    const label = h('div', { style: { fontSize: '12px', marginBottom: '6px', opacity: 0.8 } }, 'Select language:');
    const select = h('select', { 
      id: 'wordle-translate-lang-select',
      style: { 
        width: '100%', 
        padding: '6px', 
        background: '#222', 
        color: '#fff', 
        border: '1px solid #444', 
        borderRadius: '4px',
        fontSize: '12px'
      }
    });
    
    // Add default option
    const defaultOption = h('option', { value: '' }, 'Choose a language...');
    select.appendChild(defaultOption);
    
    // Add language options
    languages.forEach(lang => {
      const option = h('option', { value: lang.code }, lang.name);
      select.appendChild(option);
    });
    
    selectContainer.append(label, select);
    translationSection.appendChild(selectContainer);
    
    // Translation result area
    const resultArea = h('div', { id: 'translate-result', style: { fontSize: '12px', lineHeight: '1.4' } });
    translationSection.appendChild(resultArea);
    
    // Insert the language dropdown into the fixed bottom section
    const bottomSection = document.getElementById('wordle-bottom-section');
    if (bottomSection) {
      // Insert right above the action buttons
      const actionButtons = bottomSection.querySelector('div');
      if (actionButtons) {
        bottomSection.insertBefore(translationSection, actionButtons);
      } else {
        bottomSection.appendChild(translationSection);
      }
    } else {
      // Fallback: insert at the top if bottom section not found
      box.insertBefore(translationSection, box.firstChild);
    }
    
    // Handle language selection
    select.addEventListener('change', async (e) => {
      const langCode = e.target.value;
      if (!langCode) {
        resultArea.innerHTML = '';
        return;
      }
      
      resultArea.innerHTML = `<div style="opacity: 0.7;">Translating to ${languages.find(l => l.code === langCode).name}...</div>`;
      
      try {
        // Get current definitions to provide context for translation
        const definitions = window.currentWordDefinitions || [];
        const definitionsParam = encodeURIComponent(JSON.stringify(definitions));
        
        // Add loading message for translation
        const loadingMsg = document.createElement('div');
        loadingMsg.id = 'translation-loading-msg';
        loadingMsg.style.cssText = 'margin-top: 12px; margin-bottom: 8px; color: #ffffff; font-style: italic; text-align: center; font-weight: 600; font-size: 16px;';
        loadingMsg.textContent = '🌐 Translating...';
        bottomSection.appendChild(loadingMsg);
        
        // Add loading bar for translation in the fixed bottom section
        if (bottomSection) {
          const loadingBar = document.createElement('div');
          loadingBar.id = 'translation-loading-bar';
          loadingBar.style.cssText = 'width: 100%; height: 16px; background: #e0e0e0; margin: 12px 0; border-radius: 8px; overflow: hidden; border: 2px solid #3F6C91;';
          const loadingFill = document.createElement('div');
          loadingFill.style.cssText = 'height: 100%; background: #3F6C91; width: 0%; transition: width 0.2s ease; border-radius: 6px;';
          loadingBar.appendChild(loadingFill);
          bottomSection.appendChild(loadingBar);
          
          // Simple loading animation with minimum display time
          let progress = 0;
          const loadingInterval = setInterval(() => {
            progress += 3;
            if (progress > 95) progress = 95;
            loadingFill.style.width = progress + '%';
          }, 40);
          
          // Force minimum display time of 800ms
          setTimeout(() => {
            if (loadingFill) {
              loadingFill.style.width = '100%';
            }
          }, 800);
          
          // Store interval reference for cleanup
          window.translationLoadingInterval = loadingInterval;
        }
        
        const response = await fetch(`http://127.0.0.1:8787/translate?word=${word}&lang=${langCode}&definitions=${definitionsParam}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        
        // Clean up translation loading bar
        if (window.translationLoadingInterval) {
          clearInterval(window.translationLoadingInterval);
          window.translationLoadingInterval = null;
        }
        
        // Complete the loading bar animation
        const bottomSectionForCleanup = document.getElementById('wordle-bottom-section');
        if (bottomSectionForCleanup) {
          const loadingBars = bottomSectionForCleanup.querySelectorAll('div[style*="background: #333"]');
          loadingBars.forEach(bar => {
            const fill = bar.querySelector('div[style*="background: #4CAF50"]');
            if (fill) fill.style.width = '100%';
          });
        }
        
        if (data.translations && data.translations.length > 0) {
          // Populate each translation placeholder below its corresponding definition
          data.translations.forEach((trans, index) => {
            const translationPlaceholder = document.getElementById(`translation-${index}`);
            if (translationPlaceholder) {
              translationPlaceholder.style.cssText = 'margin-left: 20px; margin-bottom: 12px; color: #ffffff;';
              
              let content = '';
              
              // Add translation subtitle - get language name from the selected language
              const selectedLanguage = languages.find(l => l.code === langCode);
              const languageName = selectedLanguage ? selectedLanguage.name : 'Unknown';
              content += `<div style="color: #3F6C91; font-weight: 600; margin-bottom: 4px;">Translation to ${languageName}:</div>`;
              
              // Show part of speech and definition context
              if (trans.partOfSpeech) {
                content += `<strong style="color: #ffffff;">${trans.partOfSpeech}:</strong> `;
              }
              
              // Show the translation
              content += `<strong style="color: #ffffff;">${word.toUpperCase()} → ${trans.translation}</strong>`;
              
              // Show pronunciation if available
              if (trans.pronunciation) {
                content += `<br><span style="opacity: 0.8; font-style: italic;">${trans.pronunciation}</span>`;
              }
              
              // Show definition in target language if available
              if (trans.definitionInTargetLang) {
                content += `<br><span style="opacity: 0.9;">${trans.definitionInTargetLang}</span>`;
              }
              
              translationPlaceholder.innerHTML = content;
            }
          });
          
          // Remove the translation section after populating placeholders
          const translationSection = document.getElementById('translation-section');
          if (translationSection) {
            translationSection.remove();
          }
          
          // Remove translation loading bars specifically
          const bottomSection = document.getElementById('wordle-bottom-section');
          if (bottomSection) {
            const translationLoadingBar = bottomSection.querySelector('#translation-loading-bar');
            if (translationLoadingBar) translationLoadingBar.remove();
            
            const translationLoadingMsg = bottomSection.querySelector('#translation-loading-msg');
            if (translationLoadingMsg) translationLoadingMsg.remove();
          }
        } else {
          // Show error message in the first translation placeholder
          const firstPlaceholder = document.getElementById('translation-0');
          if (firstPlaceholder) {
            firstPlaceholder.style.cssText = 'margin-left: 20px; margin-bottom: 12px; color: #ffffff; font-style: italic;';
            firstPlaceholder.textContent = 'Translation not available.';
          }
        }
      } catch (error) {
        console.error('Translation failed:', error);
        resultArea.innerHTML = 'Translation failed.';
      }
    });
  }

  function buttonStyle(color) {
    return {
      background: color, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer',
      padding: '4px 8px', fontWeight: 600, fontSize: '12px'
    };
  }
  
  // Function to play pronunciation audio
  function playPronunciation(audioUrl, phonetic) {
    if (audioUrl) {
      // Try to play the audio file first
      const audio = new Audio(audioUrl);
      audio.play().catch(error => {
        console.log('Audio file failed, falling back to TTS:', error);
        // Fallback to browser TTS
        speakText(phonetic);
      });
    } else if (phonetic) {
      // No audio file, use TTS directly
      speakText(phonetic);
    }
  }
  
  // Function to use browser's text-to-speech
  function speakText(text) {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.8; // Slightly slower for clarity
      speechSynthesis.speak(utterance);
    } else {
      console.log('Speech synthesis not supported');
    }
  }
  
  // Function to fetch sentence for a specific definition
  async function fetchSentenceForDefinition(word, definitionIndex) {
            // Fetching sentence for definition
    
    try {
      // Show loading indicator for this specific definition
      const sentencePlaceholder = document.getElementById(`sentence-${definitionIndex}`);
      if (sentencePlaceholder) {
        sentencePlaceholder.style.cssText = 'margin-left: 20px; margin-bottom: 12px; color: #ffffff; font-style: italic; display: block;';
        
        // Clear the placeholder and add loading elements
        sentencePlaceholder.innerHTML = '';
        
        // Add loading message
        const loadingMsg = document.createElement('div');
        loadingMsg.id = `sentence-loading-msg-${definitionIndex}`;
        loadingMsg.style.cssText = 'margin-bottom: 8px; color: #ffffff; font-style: italic; font-size: 14px; font-weight: 500; opacity: 1; text-align: center;';
        loadingMsg.textContent = '🔍 Looking for a sentence with our word...';
        sentencePlaceholder.appendChild(loadingMsg);
        
        // Add simple blue loading bar with forced visibility
        const loadingBar = document.createElement('div');
        loadingBar.id = `sentence-loading-bar-${definitionIndex}`;
        
        // Set styles individually to avoid conflicts
        loadingBar.style.setProperty('width', '100%', 'important');
        loadingBar.style.setProperty('height', '4px', 'important'); // 30% thinner (was 6px, now 4px)
        loadingBar.style.setProperty('background', '#e0e0e0', 'important');
        loadingBar.style.setProperty('margin', '8px 0', 'important');
        loadingBar.style.setProperty('border-radius', '2px', 'important');
        loadingBar.style.setProperty('overflow', 'hidden', 'important');
        loadingBar.style.setProperty('border', '1px solid #3F6C91', 'important'); // Thinner border
        loadingBar.style.setProperty('display', 'block', 'important');
        loadingBar.style.setProperty('visibility', 'visible', 'important');
        loadingBar.style.setProperty('opacity', '1', 'important');
        loadingBar.style.setProperty('z-index', '9999', 'important');
        loadingBar.style.setProperty('position', 'relative', 'important');
        loadingBar.style.setProperty('left', '0', 'important');
        loadingBar.style.setProperty('top', '0', 'important');
        
        const loadingFill = document.createElement('div');
        loadingFill.style.setProperty('height', '100%', 'important');
        loadingFill.style.setProperty('background', '#3F6C91', 'important'); // Our brand blue color
        loadingFill.style.setProperty('width', '0%', 'important');
        loadingFill.style.setProperty('transition', 'width 0.2s ease', 'important');
        loadingFill.style.setProperty('border-radius', '2px', 'important');
        loadingFill.style.setProperty('display', 'block', 'important');
        loadingFill.style.setProperty('visibility', 'visible', 'important');
        loadingFill.style.setProperty('opacity', '1', 'important');
        
        loadingBar.appendChild(loadingFill);
        sentencePlaceholder.appendChild(loadingBar);
        
        // Debug: Log the loading bar creation
        console.log('Loading bar created:', loadingBar);
        console.log('Loading bar parent:', sentencePlaceholder);
        console.log('Loading bar visible:', loadingBar.offsetHeight > 0);
        
        // Force the loading bar to be visible after a short delay
        setTimeout(() => {
          loadingBar.style.setProperty('width', '100%', 'important');
          loadingBar.style.setProperty('height', '4px', 'important'); // 30% thinner
          loadingBar.style.setProperty('display', 'block', 'important');
          loadingBar.style.setProperty('visibility', 'visible', 'important');
          loadingBar.style.setProperty('opacity', '1', 'important');
          loadingBar.style.setProperty('position', 'relative', 'important');
          loadingBar.style.setProperty('left', '0', 'important');
          loadingBar.style.setProperty('top', '0', 'important');
          console.log('Loading bar styles forced:', loadingBar.style.cssText);
        }, 50);
        
        // Inject CSS to override any conflicting styles
        const style = document.createElement('style');
        style.textContent = `
          #sentence-loading-bar-${definitionIndex} {
            width: 100% !important;
            height: 4px !important;
            background: #e0e0e0 !important;
            margin: 8px 0 !important;
            border-radius: 2px !important;
            overflow: hidden !important;
            border: 1px solid #3F6C91 !important;
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            z-index: 9999 !important;
            position: relative !important;
            left: 0 !important;
            top: 0 !important;
          }
          #sentence-loading-bar-${definitionIndex} > div {
            height: 100% !important;
            background: #3F6C91 !important;
            width: 0% !important;
            transition: width 0.2s ease !important;
            border-radius: 2px !important;
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
        `;
        document.head.appendChild(style);
        
        // Realistic loading animation that simulates AI processing
        let progress = 0;
        const loadingInterval = setInterval(() => {
          // Simulate realistic AI processing with variable progress
          if (progress < 30) {
            progress += Math.random() * 3 + 1; // Slow start
          } else if (progress < 70) {
            progress += Math.random() * 2 + 0.5; // Medium progress
          } else if (progress < 90) {
            progress += Math.random() * 1 + 0.2; // Slower near completion
          } else {
            progress += Math.random() * 0.5; // Very slow at the end
          }
          
          if (progress > 95) progress = 95; // Don't complete until done
          loadingFill.style.setProperty('width', progress + '%', 'important');
        }, 50);
        
        // Store interval for cleanup
        window[`sentenceLoadingInterval_${definitionIndex}`] = loadingInterval;
        
        // Force minimum display time of 2000ms (2 seconds) for better visibility
        setTimeout(() => {
          if (loadingFill) {
            loadingFill.style.setProperty('width', '100%', 'important');
          }
        }, 2000);
      }
      
      // Force minimum loading time to ensure visibility
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const response = await fetch(`http://127.0.0.1:8787/sentence?word=${word}&definitionIndex=${definitionIndex}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      // Clean up loading
      if (window[`sentenceLoadingInterval_${definitionIndex}`]) {
        clearInterval(window[`sentenceLoadingInterval_${definitionIndex}`]);
        delete window[`sentenceLoadingInterval_${definitionIndex}`];
      }
      
      if (data.sentence) {
        const sentence = data.sentence;
        
        if (sentencePlaceholder) {
          try {
            sentencePlaceholder.style.cssText = 'margin-left: 20px; margin-bottom: 12px; color: #ffffff; display: block;';
            
            // Remove loading elements
            const loadingBar = sentencePlaceholder.querySelector(`#sentence-loading-bar-${definitionIndex}`);
            if (loadingBar) loadingBar.remove();
            
            // Remove loading message if it exists
            const loadingMsg = sentencePlaceholder.querySelector(`#sentence-loading-msg-${definitionIndex}`);
            if (loadingMsg) loadingMsg.remove();
            

            
            // Get the definition context for this specific sentence
            const definition = data.definition || window.currentWordDefinitions?.[definitionIndex];
            if (definition) {
              const def = definition;
              let defType = 'Word';
              
              if (typeof def === 'object' && def.partOfSpeech) {
                defType = def.partOfSpeech.charAt(0).toUpperCase() + def.partOfSpeech.slice(1);
              } else if (typeof def === 'string') {
                if (def.includes('noun')) defType = 'Noun';
                else if (def.includes('verb')) defType = 'Verb';
                else if (def.includes('adjective')) defType = 'Adjective';
                else if (def.includes('adverb')) defType = 'Adverb';
              }
              
              sentencePlaceholder.innerHTML = `<div style="color: #3F6C91; font-weight: 600; margin-bottom: 4px;">Sentence Example:</div><strong style="color: #ffffff;">${defType}:</strong> ${sentence}`;
            } else {
              sentencePlaceholder.textContent = sentence;
            }
          } catch (error) {
            console.error('Error updating sentence placeholder:', error);
            // Clean up loading elements on error
            const loadingBar = sentencePlaceholder.querySelector(`#sentence-loading-bar-${definitionIndex}`);
            if (loadingBar) loadingBar.remove();
            
            const loadingMsg = sentencePlaceholder.querySelector(`#sentence-loading-msg-${definitionIndex}`);
            if (loadingMsg) loadingMsg.remove();
            
            sentencePlaceholder.textContent = sentence;
          }
        }
      } else {
        // No sentence found for this definition index
        if (sentencePlaceholder) {
          // Clean up loading elements
          const loadingBar = sentencePlaceholder.querySelector(`#sentence-loading-bar-${definitionIndex}`);
          if (loadingBar) loadingBar.remove();
          
          const loadingMsg = sentencePlaceholder.querySelector(`#sentence-loading-msg-${definitionIndex}`);
          if (loadingMsg) loadingMsg.remove();
          
          sentencePlaceholder.style.cssText = 'margin-left: 20px; margin-bottom: 12px; color: #f66; font-style: italic; display: block;';
          sentencePlaceholder.textContent = 'No sentence found for this definition.';
        }
      }
    } catch (error) {
      console.error('Couldn\'t fetch sentence for definition:', error);
      
      // Clean up loading on error
      if (window[`sentenceLoadingInterval_${definitionIndex}`]) {
        clearInterval(window[`sentenceLoadingInterval_${definitionIndex}`]);
        delete window[`sentenceLoadingInterval_${definitionIndex}`];
      }
      
      // Show error message
      if (sentencePlaceholder) {
        // Remove any existing loading elements
        const loadingBar = sentencePlaceholder.querySelector(`#sentence-loading-bar-${definitionIndex}`);
        if (loadingBar) loadingBar.remove();
        
        const loadingMsg = sentencePlaceholder.querySelector(`#sentence-loading-msg-${definitionIndex}`);
        if (loadingMsg) loadingMsg.remove();
        
        sentencePlaceholder.style.cssText = 'margin-left: 20px; margin-bottom: 12px; color: #f66; font-style: italic; display: block;';
        sentencePlaceholder.textContent = 'Failed to load sentence.';
      }
    }
  }
  
  // Function to show translate dropdown for a specific definition
  function showTranslateDropdownForDefinition(word, definitionIndex) {
            // Showing translation dropdown for definition
    
    // Get the current definitions to provide context
    const definitions = window.currentWordDefinitions || [];
    const targetDefinition = definitions[definitionIndex];
    
    if (!targetDefinition) {
      console.error('No definition found for index:', definitionIndex);
      return;
    }
    
    // Create a simple language selection for this specific definition
    const languages = [
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'pt', name: 'Portuguese' }
    ];
    
    // Create a small dropdown above the definition
    const dropdownContainer = document.createElement('div');
    dropdownContainer.style.cssText = 'margin-left: 20px; margin-top: 12px; padding: 12px; background: #161b22; border-radius: 6px; border: 1px solid #30363d; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);';
    
    const label = document.createElement('div');
    label.style.cssText = 'font-size: 12px; margin-bottom: 8px; color: #f0f6fc; font-weight: 500;';
    label.textContent = 'Select language:';
    dropdownContainer.appendChild(label);
    
    const select = document.createElement('select');
    select.style.cssText = 'width: 100%; padding: 8px 12px; background: #0d1117; color: #f0f6fc; border: 1px solid #30363d; border-radius: 6px; font-size: 12px; font-weight: 500; transition: all 0.2s ease;';
    
    // Add hover effects to select
    select.addEventListener('mouseenter', () => {
      select.style.borderColor = '#3F6C91';
      select.style.boxShadow = '0 0 0 3px rgba(63, 108, 145, 0.1)';
    });
    
    select.addEventListener('mouseleave', () => {
      select.style.borderColor = '#30363d';
      select.style.boxShadow = 'none';
    });
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Choose a language...';
    select.appendChild(defaultOption);
    
    // Add language options
    languages.forEach(lang => {
      const option = document.createElement('option');
      option.value = lang.code;
      option.textContent = lang.name;
      select.appendChild(option);
    });
    
    dropdownContainer.appendChild(select);
    
    // Handle language selection
    select.addEventListener('change', async (e) => {
      const langCode = e.target.value;
      if (!langCode) return;
      
      try {
        // Show loading indicator for this specific definition
        const translationPlaceholder = document.getElementById(`translation-${definitionIndex}`);
        if (translationPlaceholder) {
          translationPlaceholder.style.cssText = 'margin-left: 20px; margin-bottom: 12px; color: #666; font-style: italic; display: block;';
          translationPlaceholder.textContent = `Translating to ${languages.find(l => l.code === langCode).name}...`;
          
          // Add thin blue loading bar with forced visibility
          const loadingBar = document.createElement('div');
          loadingBar.id = `translation-loading-bar-${definitionIndex}`;
          
          // Set styles individually to avoid conflicts
          loadingBar.style.setProperty('width', '100%', 'important');
          loadingBar.style.setProperty('height', '4px', 'important'); // 30% thinner (4px height)
          loadingBar.style.setProperty('background', '#e0e0e0', 'important');
          loadingBar.style.setProperty('margin', '8px 0', 'important');
          loadingBar.style.setProperty('border-radius', '2px', 'important');
          loadingBar.style.setProperty('overflow', 'hidden', 'important');
          loadingBar.style.setProperty('border', '1px solid #3F6C91', 'important'); // Thinner border
          loadingBar.style.setProperty('display', 'block', 'important');
          loadingBar.style.setProperty('visibility', 'visible', 'important');
          loadingBar.style.setProperty('opacity', '1', 'important');
          loadingBar.style.setProperty('z-index', '9999', 'important');
          loadingBar.style.setProperty('position', 'relative', 'important');
          loadingBar.style.setProperty('left', '0', 'important');
          loadingBar.style.setProperty('top', '0', 'important');
          
          const loadingFill = document.createElement('div');
          loadingFill.style.setProperty('height', '100%', 'important');
          loadingFill.style.setProperty('background', '#3F6C91', 'important'); // Our brand blue color
          loadingFill.style.setProperty('width', '0%', 'important');
          loadingFill.style.setProperty('transition', 'width 0.2s ease', 'important');
          loadingFill.style.setProperty('border-radius', '2px', 'important');
          loadingFill.style.setProperty('display', 'block', 'important');
          loadingFill.style.setProperty('visibility', 'visible', 'important');
          loadingFill.style.setProperty('opacity', '1', 'important');
          
          loadingBar.appendChild(loadingFill);
          translationPlaceholder.appendChild(loadingBar);
          
          // Debug: Log the loading bar creation
          console.log('Translation loading bar created:', loadingBar);
          console.log('Translation loading bar parent:', translationPlaceholder);
          console.log('Translation loading bar visible:', loadingBar.offsetHeight > 0);
          
          // Force the loading bar to be visible after a short delay
          setTimeout(() => {
            loadingBar.style.setProperty('width', '100%', 'important');
            loadingBar.style.setProperty('height', '4px', 'important'); // 30% thinner
            loadingBar.style.setProperty('display', 'block', 'important');
            loadingBar.style.setProperty('visibility', 'visible', 'important');
            loadingBar.style.setProperty('opacity', '1', 'important');
            loadingBar.style.setProperty('position', 'relative', 'important');
            loadingBar.style.setProperty('left', '0', 'important');
            loadingBar.style.setProperty('top', '0', 'important');
            console.log('Translation loading bar styles forced:', loadingBar.style.cssText);
          }, 50);
          
          // Inject CSS to override any conflicting styles
          const style = document.createElement('style');
          style.textContent = `
            #translation-loading-bar-${definitionIndex} {
              width: 100% !important;
              height: 4px !important;
              background: #e0e0e0 !important;
              margin: 8px 0 !important;
              border-radius: 2px !important;
              overflow: hidden !important;
              border: 1px solid #3F6C91 !important;
              display: block !important;
              visibility: visible !important;
              opacity: 1 !important;
              z-index: 9999 !important;
              position: relative !important;
              left: 0 !important;
              top: 0 !important;
            }
            #translation-loading-bar-${definitionIndex} > div {
              height: 100% !important;
              background: #3F6C91 !important;
              width: 0% !important;
              transition: width 0.2s ease !important;
              border-radius: 2px !important;
              display: block !important;
              visibility: visible !important;
              opacity: 1 !important;
            }
          `;
          document.head.appendChild(style);
          
          // Realistic loading animation that simulates AI processing
          let progress = 0;
          const loadingInterval = setInterval(() => {
            // Simulate realistic AI processing with variable progress
            if (progress < 30) {
              progress += Math.random() * 3 + 1; // Slow start
            } else if (progress < 70) {
              progress += Math.random() * 2 + 0.5; // Medium progress
            } else if (progress < 90) {
              progress += Math.random() * 1 + 0.2; // Slower near completion
            } else {
              progress += Math.random() * 0.5; // Very slow at the end
            }
            
            if (progress > 95) progress = 95; // Don't complete until done
            loadingFill.style.setProperty('width', progress + '%', 'important');
          }, 50);
          
          // Store interval for cleanup
          window[`translationLoadingInterval_${definitionIndex}`] = loadingInterval;
          
          // Force minimum display time of 2000ms (2 seconds) for better visibility
          setTimeout(() => {
            if (loadingFill) {
              loadingFill.style.setProperty('width', '100%', 'important');
            }
          }, 2000);
        }
        
        // Get current definitions to provide context for translation
        const definitionsParam = encodeURIComponent(JSON.stringify([targetDefinition]));
        
        const response = await fetch(`http://127.0.0.1:8787/translate?word=${word}&lang=${langCode}&definitions=${definitionsParam}`);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const responseText = await response.text();
        
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error(`Failed to parse translation response:`, parseError);
          throw new Error(`Invalid JSON response: ${responseText}`);
        }
        
        // Clean up loading
        if (window[`translationLoadingInterval_${definitionIndex}`]) {
          clearInterval(window[`translationLoadingInterval_${definitionIndex}`]);
          delete window[`translationLoadingInterval_${definitionIndex}`];
        }
        
        if (data.translations && data.translations[0]) {
          const trans = data.translations[0];
          // Translation data received
          
          const translationPlaceholder = document.getElementById(`translation-${definitionIndex}`);
          
          if (translationPlaceholder) {
            try {
              // Remove loading bar
              const loadingBar = translationPlaceholder.querySelector(`#translation-loading-bar-${definitionIndex}`);
              if (loadingBar) loadingBar.remove();
              
              translationPlaceholder.style.cssText = 'margin-left: 20px; margin-bottom: 12px; color: #ffffff; display: block;';
              
              let content = '';
              
              // Add translation subtitle - get language name from the selected language
              const selectedLanguage = languages.find(l => l.code === langCode);
              const languageName = selectedLanguage ? selectedLanguage.name : 'Unknown';
              content += `<div style="color: #3F6C91; font-weight: 600; margin-bottom: 4px;">Translation to ${languageName}:</div>`;
              
              // Show part of speech and definition context
              if (trans.partOfSpeech) {
                content += `<strong style="color: #ffffff;">${trans.partOfSpeech}:</strong> `;
              }
              
              // Show the translation
              content += `<strong style="color: #ffffff;">${word.toUpperCase()} → ${trans.translation}</strong>`;
              
              // Show pronunciation if available
              if (trans.pronunciation) {
                content += `<br><span style="opacity: 0.8; font-style: italic;">${trans.pronunciation}</span>`;
              }
              
              // Show definition in target language if available
              if (trans.definitionInTargetLang) {
                content += `<br><span style="opacity: 0.9;">${trans.definitionInTargetLang}</span>`;
              }
              
              // Setting translation content
              translationPlaceholder.innerHTML = content;
            } catch (error) {
              console.error(`Error updating translation placeholder:`, error);
              translationPlaceholder.textContent = `Translation: ${trans.translation}`;
            }
          }
        } else {
          console.error('No translations found in response:', data);
          // Show error message
          const translationPlaceholder = document.getElementById(`translation-${definitionIndex}`);
          if (translationPlaceholder) {
            try {
              translationPlaceholder.style.cssText = 'margin-left: 20px; margin-bottom: 12px; color: #ffffff; display: block;';
              translationPlaceholder.textContent = 'Translation failed - no data received.';
            } catch (error) {
              console.error('Error setting error message:', error);
            }
          }
        }
        
        // Remove the dropdown after selection
        if (dropdownContainer && dropdownContainer.remove) {
          try {
            dropdownContainer.remove();
          } catch (error) {
            console.error('Error removing dropdown:', error);
          }
        }
        
      } catch (error) {
        console.error('Translation failed:', error);
        if (dropdownContainer && dropdownContainer.remove) {
          try {
            dropdownContainer.remove();
          } catch (error) {
            console.error('Error removing dropdown on error:', error);
          }
        }
      }
    });
    
    // Add the dropdown below the definition
    try {
      const li = document.querySelector(`#wordle-content-box li:nth-child(${definitionIndex + 1})`);
      if (li && dropdownContainer) {
        li.appendChild(dropdownContainer);
      } else {
        console.warn(`Could not find list item at index ${definitionIndex} or dropdown container is missing`);
      }
    } catch (error) {
      console.error('Error placing dropdown:', error);
    }
  }

  async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  function mapStateToChar(state){
    if(state==='correct')return 'g';
    if(state==='present')return 'y';
    return 'b';
  }
  function readWordleState(){
    const app=document.querySelector('game-app');
    const root=app&&app.shadowRoot; const guesses=[]; const feedback=[];
    function readFromRows(getRows,getTiles){
      const rows=getRows()||[]; for(const row of rows){
        const tiles=getTiles(row); if(!tiles||tiles.length!==5) continue;
        const letters=tiles.map(t=>t.getAttribute('letter')||t.getAttribute('data-letter')||t.textContent?.trim()?.[0]||'').join('');
        const states=tiles.map(t=>t.getAttribute('evaluation')||t.getAttribute('data-state')||t.getAttribute('data-status')||'');
        if(letters.length===5 && states.every(s=>['correct','present','absent'].includes(s))){
          guesses.push(letters.toLowerCase()); feedback.push(states.map(mapStateToChar).join(''));
        }
      }
    }
    if(root){
      readFromRows(()=>root.querySelector('#board')?.querySelectorAll('game-row'),(row)=>row.shadowRoot?Array.from(row.shadowRoot.querySelectorAll('game-tile')):Array.from(row.querySelectorAll('game-tile')));
    }else{
      readFromRows(()=>document.querySelectorAll('game-row, .row, [data-row]'),(row)=>Array.from(row.querySelectorAll('game-tile, .tile, [data-state]')));
    }
    return {guesses,feedback};
  }
  async function postState(){
    const state=readWordleState();
    try{ await fetch(`${BRIDGE}/state`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)});}catch(e){}
  }

  async function refresh(list, history, historyTitle) {
            // Refresh function called
    try {
      // Auto-sync current board to the bridge before fetching suggestions
      await postState();
      const state = await fetchJson(`${BRIDGE}/state`);
      // Render on-board guesses with Definition/Sentence buttons
      try {
        const uniq = [];
        const seen = new Set();
        for (const w of (state.guesses || [])) {
          const lw = String(w || '').toLowerCase();
          if (!lw || seen.has(lw)) continue;
          seen.add(lw);
          uniq.push(lw);
        }
        history.innerHTML = '';
        if (uniq.length) {
          historyTitle.style.display = 'block';
          for (const g of uniq) {
            // Add word display and buttons for each word
            const wordContainer = h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' } });
            
            // Display the word
            const wordDisplay = h('div', { 
              style: { 
                fontWeight: 700, 
                fontSize: '13px', 
                letterSpacing: '1px',
                color: '#fff'
              } 
            }, g.toUpperCase());
            
                          // Info button that shows definitions
              const infoBtn = h('button', {
                style: { 
                  background: '#3F6C91', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: '6px', 
                  padding: '6px 12px', 
                  fontSize: '12px', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                },
                onclick: () => {
                  // Past guesses button clicked
                  showDefinition(g);
                },
                onmouseenter: (e) => {
                  e.target.style.background = '#58a6ff';
                },
                onmouseleave: (e) => {
                  e.target.style.background = '#3F6C91';
                }
              });
            
            // Add the custom SVG icon
            const svgIcon = document.createElement('div');
            svgIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" style="fill: #fff; stroke: #fff;">
              <circle cx="12" cy="12" r="8.75" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2.5"></circle>
              <line x1="12" x2="12" y1="16.81" y2="12.21" fill="none" stroke="currentColor" stroke-linecap="square" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2.402"></line>
              <circle cx="12" cy="8.25" r="1.25" fill-rule="evenodd" clip-rule="evenodd" opacity=".3"></circle>
              <rect width="2.5" height="2.5" x="10.761" y="6.986" fill-rule="evenodd" clip-rule="evenodd"></rect>
            </svg>`;
            
            infoBtn.appendChild(svgIcon);
            infoBtn.appendChild(document.createTextNode(' More Info'));
            
            wordContainer.appendChild(wordDisplay);
            wordContainer.appendChild(infoBtn);
            history.appendChild(wordContainer);
          }
        } else {
          historyTitle.style.display = 'none';
        }
      } catch {}

      // Always ask AI to produce suggestions based on current state
      let usedAi = true;
      let items = [];
      try {
        const rer = await fetch(`${BRIDGE}/rerank`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guesses: state.guesses || [], feedback: state.feedback || [], candidates: [], limit: 10 })
        });
        const rr = await rer.json().catch(() => ({}));
        if (rr && Array.isArray(rr.ranked) && rr.ranked.length) {
          items = rr.ranked.map(r => ({ word: r.word || r, score: r.score || 0 }));
        }
      } catch {}
      // Fallback to local solver if AI returns nothing (network/model issue)
      if (!items.length) {
        usedAi = false;
        const data = await fetchJson(`${BRIDGE}/suggest?limit=10&_=${Date.now()}`);
        items = data.suggestions || [];
      }
      
      // If solved, show congrats instead of suggestions
      if (Array.isArray(state.feedback) && state.feedback.some(f => f === 'ggggg')) {
        list.innerHTML = '';
        const tries = (state.feedback || []).findIndex(f => f === 'ggggg') + 1 || (state.feedback || []).length;
        list.appendChild(h('div', { style: { fontSize: '13px', fontWeight: 700, marginBottom: '4px' } }, '🎉 Congrats!'));
        list.appendChild(h('div', { style: { fontSize: '12px', opacity: 0.9 } }, `Solved in ${tries} ${tries === 1 ? 'try' : 'tries'}.`));
        const src = document.getElementById('wordle-source-footer');
        if (src) src.textContent = 'Puzzle solved';
        
        // Hide the suggestions title when showing congrats
        const suggestTitle = document.getElementById('wordle-suggest-title');
        if (suggestTitle) suggestTitle.style.display = 'none';
        return;
      }
      
      // Show suggestions title for active games
      const suggestTitle = document.getElementById('wordle-suggest-title');
      if (suggestTitle) suggestTitle.style.display = 'block';
      
      list.innerHTML = '';
      if (!items.length) {
        list.appendChild(h('div', { style: { fontSize: '12px', opacity: 0.8 } }, 'No suggestions. Make a guess, then try refresh.'));
        return;
      }
      for (const { word } of items) {
          const row = h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center' } },
            h('div', { style: { fontWeight: 700, fontSize: '13px', letterSpacing: '1px' } }, word.toUpperCase()),
            h('div', { style: { marginLeft: 'auto', display: 'flex', gap: '6px' } },
              h('button', { 
                style: { 
                  background: '#3F6C91', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: '6px', 
                  padding: '6px 12px', 
                  fontSize: '12px', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }, 
                onclick: () => {
                  // Button clicked for word
                  showDefinition(word);
                },
                onmouseenter: (e) => {
                  e.target.style.background = '#58a6ff';
                },
                onmouseleave: (e) => {
                  e.target.style.background = '#3F6C91';
                }
              })
            )
          );
          
          // Add the custom SVG icon to the button
          const button = row.querySelector('button');
          if (button) {
            const svgIcon = document.createElement('div');
            svgIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" style="fill: #fff; stroke: #fff;">
              <circle cx="12" cy="12" r="8.75" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2.5"></circle>
              <line x1="12" x2="12" y1="16.81" y2="12.21" fill="none" stroke="currentColor" stroke-linecap="square" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="2.402"></line>
              <circle cx="12" cy="8.25" r="1.25" fill-rule="evenodd" clip-rule="evenodd" opacity=".3"></circle>
              <rect width="2.5" height="2.5" x="10.761" y="6.986" fill-rule="evenodd" clip-rule="evenodd"></rect>
            </svg>`;
            
            button.appendChild(svgIcon);
            button.appendChild(document.createTextNode(' More Info'));
          }
          
          // Update button text to show current state
        list.appendChild(row);
      }
      // Footer text removed for cleaner UI
    } catch (e) {
      list.innerHTML = '';
      list.appendChild(h('div', { style: { fontSize: '12px', color: '#ffffff' } }, 'Can\'t reach local solver. Make sure it\'s running.'));
    }
  }

  // Track current content type for each word
  const wordContentStates = new Map();
  
  function showDefinition(word) {
            // Showing definition for word
    
    const defWrap = document.getElementById('wordle-def-wrap');
    if (!defWrap) {
      console.error('[DEBUG] Could not find wordle-def-wrap element');
      return;
    }
    
            // Definition wrapper found, displaying
    defWrap.style.display = 'block';
    
            // Calling fetchDefinition
    fetchDefinition(word);
  }

  function install() {
            // Install function called
    const { list, history, historyTitle } = createPanel();
            // Panel created, calling refresh
    refresh(list, history, historyTitle);

    // Debounced auto refresh helpers
    let t; const schedule = (delay=1200) => { clearTimeout(t); t = setTimeout(() => refresh(list, history, historyTitle), delay); };

    // Auto refresh on changes (rows/tiles updates)
    const obs = new MutationObserver((muts) => {
      const relevant = muts.some(m => m.type === 'attributes' || (m.addedNodes && m.addedNodes.length));
      if (relevant) schedule(1200);
    });
    const app = document.querySelector('game-app');
    const root = app?.shadowRoot;
    const board = root?.querySelector('#board') || document.querySelector('#board, .board, .Rows, .rows, game-app, #game') || document.body;
    obs.observe(board, { subtree: true, childList: true, attributes: true, attributeFilter: ['evaluation','data-state','data-status'] });

    // Also listen for Enter key and tab visibility changes
    document.addEventListener('keydown', (e) => { if (e.key === 'Enter') schedule(1500); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(500); });
  }

  const ready = setInterval(() => {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      clearInterval(ready); 
              // Document ready, installing Wordle helper
      install();
    }
  }, 500);
})();


