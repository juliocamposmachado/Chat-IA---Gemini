import { useEffect, useRef, useState } from 'react';
import { HelpCircle, Palette } from 'lucide-react';
import { FileSystem } from '../utils/fileSystem';
import { executeCommand } from '../utils/commands';
import { translations, getTranslation } from '../utils/translations';

function Terminal() {
  const [output, setOutput] = useState<Array<{ type: 'command' | 'output', content: string }>>([]);
  const [currentPath, setCurrentPath] = useState('/home/user');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [inputValue, setInputValue] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [bgColor, setBgColor] = useState('#0a0e27');
  const [isLoading, setIsLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const fileSystemRef = useRef(new FileSystem());

  const userLanguage = navigator.language || 'en';
  const isEnglish = !userLanguage.startsWith('fr');
  const t = (key: string) => getTranslation(key, isEnglish);

  useEffect(() => {
    const welcomeMessage = t('welcome');
    setOutput([{ type: 'output', content: welcomeMessage }]);
  }, []);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  useEffect(() => {
    if (!isEditorOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (isEditorOpen && editorRef.current) {
      editorRef.current.focus();
    }
  }, [isEditorOpen]);

  const getPrompt = () => {
    const pathDisplay = currentPath.replace('/home/user', '~');
    return `user@ubuntu:${pathDisplay}$ `;
  };

  const handleCommand = async (commandLine: string) => {
    if (!commandLine.trim()) return;

    setCommandHistory(prev => [...prev, commandLine]);
    setHistoryIndex(-1);

    setOutput(prev => [...prev, { type: 'command', content: `${getPrompt()}${commandLine}` }]);

    const trimmedCommand = commandLine.trim().split(' ')[0];

    if (trimmedCommand === 'ask') {
      setIsLoading(true);
      const question = commandLine.substring(4).trim();

      if (!question) {
        setOutput(prev => [...prev, { type: 'output', content: '<span class="text-red-400">ask: question required</span>' }]);
        setInputValue('');
        setIsLoading(false);
        return;
      }

      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        const response = await fetch(`${supabaseUrl}/functions/v1/gemini-chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ message: question }),
        });

        if (!response.ok) {
          throw new Error('AI response error');
        }

        const data = await response.json();
        const aiResponse = data.response || 'No response from AI';

        setOutput(prev => [...prev, { type: 'output', content: `<span class="text-blue-400">${aiResponse}</span>` }]);
      } catch (error) {
        setOutput(prev => [...prev, { type: 'output', content: `<span class="text-red-400">Error: ${error instanceof Error ? error.message : 'Failed to get AI response'}</span>` }]);
      } finally {
        setIsLoading(false);
      }
    } else {
      const result = executeCommand(
        commandLine,
        currentPath,
        fileSystemRef.current,
        {
          setCurrentPath,
          openEditor: (filename: string, content: string) => {
            setCurrentFile(filename);
            setEditorContent(content);
            setIsEditorOpen(true);
          },
          clearOutput: () => setOutput([]),
          isEnglish
        }
      );

      if (result && result.trim()) {
        setOutput(prev => [...prev, { type: 'output', content: result }]);
      }
    }

    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!isLoading) {
        handleCommand(inputValue);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setInputValue('');
        } else {
          setHistoryIndex(newIndex);
          setInputValue(commandHistory[newIndex]);
        }
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
    } else if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      setOutput([]);
    } else if (e.ctrlKey && e.key === 'c') {
      e.preventDefault();
      setInputValue('');
    }
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      saveFile();
    } else if (e.ctrlKey && e.key === 'x') {
      e.preventDefault();
      closeEditor();
    } else if (e.ctrlKey && e.key === 'w') {
      e.preventDefault();
      setShowHelp(true);
    }
  };

  const saveFile = () => {
    if (!currentFile) return;

    const currentDir = fileSystemRef.current.getDirectoryAtPath(currentPath);
    if (currentDir && currentDir.children[currentFile]) {
      currentDir.children[currentFile].content = editorContent;
      setOutput(prev => [...prev, { type: 'output', content: `<span class="text-green-400">${t('fileSaved')}</span>` }]);
    }
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setCurrentFile(null);
    setEditorContent('');
  };

  return (
    <div className="min-h-screen flex flex-col font-mono text-sm" style={{ backgroundColor: bgColor }}>
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="text-gray-300">user@ubuntu: ~</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowHelp(true)}
            className="p-1 hover:bg-gray-700 rounded"
            title="Help"
          >
            <HelpCircle className="w-4 h-4 text-gray-300" />
          </button>
          <label className="p-1 hover:bg-gray-700 rounded cursor-pointer" title="Change color">
            <Palette className="w-4 h-4 text-gray-300" />
            <input
              type="color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="hidden"
            />
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {!isEditorOpen ? (
          <>
            <div
              ref={outputRef}
              className="flex-1 overflow-y-auto p-4 space-y-1"
            >
              {output.map((item, index) => (
                <div
                  key={index}
                  className={item.type === 'command' ? 'text-gray-300' : 'text-gray-100'}
                  dangerouslySetInnerHTML={{ __html: item.content }}
                />
              ))}
            </div>

            <div className="px-4 pb-4 flex items-center space-x-2 text-gray-300">
              <span className="text-green-400">{getPrompt()}</span>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent outline-none text-gray-100"
                disabled={isLoading}
                autoFocus
              />
              {isLoading && <span className="text-yellow-400 animate-pulse">...</span>}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col p-4">
            <div className="bg-gray-800 px-4 py-2 flex items-center justify-between mb-2 rounded-t">
              <span className="text-gray-300">GNU nano - {currentFile}</span>
              <button
                onClick={closeEditor}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <textarea
              ref={editorRef}
              value={editorContent}
              onChange={(e) => setEditorContent(e.target.value)}
              onKeyDown={handleEditorKeyDown}
              className="flex-1 bg-gray-900 text-gray-100 p-4 outline-none resize-none rounded-b font-mono"
              spellCheck={false}
            />
            <div className="bg-gray-800 px-4 py-2 mt-2 rounded text-xs text-gray-400">
              ^S {t('ctrlS')} | ^X {t('ctrlX')} | ^W {t('ctrlW')}
            </div>
          </div>
        )}
      </div>

      <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 text-center text-xs text-gray-400">
        <span>{t('openSource')}</span>
        <a
          href="https://github.com/RyZenoKelb/Terminux"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 ml-1"
        >
          {t('githubRepo')}
        </a>
      </div>

      {showHelp && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="bg-gray-800 rounded-lg p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-gray-100 mb-4">{t('editorShortcuts')}</h2>
            <div className="space-y-2 text-gray-300">
              <div><kbd className="bg-gray-700 px-2 py-1 rounded">Ctrl+S</kbd> - {t('ctrlS')}</div>
              <div><kbd className="bg-gray-700 px-2 py-1 rounded">Ctrl+X</kbd> - {t('ctrlX')}</div>
              <div><kbd className="bg-gray-700 px-2 py-1 rounded">Ctrl+W</kbd> - {t('ctrlW')}</div>
              <div><kbd className="bg-gray-700 px-2 py-1 rounded">Esc</kbd> - {t('escKey')}</div>
            </div>
            <button
              onClick={() => setShowHelp(false)}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded"
            >
              {t('escKey')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Terminal;
