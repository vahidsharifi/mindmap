// FILE: webapp/public/App.js
// Uses React hooks for state and effects

const App = () => {
    // --- State Variables ---
    const [bookName, setBookName] = React.useState('');
    const [authorName, setAuthorName] = React.useState('');
    const [editorContent, setEditorContent] = React.useState(''); // Holds PLAIN markdown
    const [status, setStatus] = React.useState({ message: 'App loaded. Ready to generate or load existing mindmap.', type: 'info' }); // type: 'info', 'success', 'error'
    const [isLoading, setIsLoading] = React.useState(false); // For LLM generation
    const [isEditorLoading, setIsEditorLoading] = React.useState(false); // For loading MD content
    const [isEditorSaving, setIsEditorSaving] = React.useState(false); // For saving MD content

    // State to force iframe refresh (cache busting)
    const [mindmapKey, setMindmapKey] = React.useState(Date.now()); // Initialize with timestamp

    // --- LLM Selection State ---
    const llmOptions = {
        // Define models available for each provider
        DeepSeek: ['deepseek-chat', /* 'deepseek-coder', */ 'deepseek-math'], // Add/remove models as needed
        OpenAI: ['gpt-4o-mini', 'gpt-4o'] // Example OpenAI models
    };
    const [selectedProvider, setSelectedProvider] = React.useState(Object.keys(llmOptions)[0]); // Default to first provider
    const [selectedModel, setSelectedModel] = React.useState(llmOptions[selectedProvider][0]); // Default to first model of provider

    // --- Handlers ---

    const handleProviderChange = (e) => {
        const newProvider = e.target.value;
        setSelectedProvider(newProvider);
        setSelectedModel(llmOptions[newProvider][0]); // Reset model
    };

    const handleModelChange = (e) => {
        setSelectedModel(e.target.value);
    };

    // GENERATE mindmap via backend
    const handleGenerate = async (e) => {
        e.preventDefault();
        if (!bookName.trim() || !authorName.trim()) {
            setStatus({ message: 'Please enter both Book Name and Author Name.', type: 'error' });
            return;
        }
        setIsLoading(true);
        setStatus({ message: `Generating mindmap using ${selectedProvider} (${selectedModel})... Please wait.`, type: 'info' });

        try {
            const response = await fetch('/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookName,
                    authorName,
                    provider: selectedProvider,
                    model: selectedModel
                }),
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || `Server error: ${response.statusText}`);
            }

            setStatus({ message: 'Mindmap generated! Loading editor and refreshing view...', type: 'success' });
            await handleLoadEditor(); // Load the new plain content into editor
            setMindmapKey(Date.now()); // Trigger iframe refresh
            setStatus({ message: data.message || `Mindmap generated with ${selectedProvider} (${selectedModel})! View updated.`, type: 'success' });


        } catch (err) {
            console.error('Generation failed:', err);
            setStatus({ message: `Generation failed: ${err.message}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    // LOAD plain markdown content into editor
    const handleLoadEditor = async () => {
        setIsEditorLoading(true);
        // Don't immediately clear status, wait for fetch result
        // setStatus({ message: 'Loading mindmap content into editor...', type: 'info' });
        try {
            // Fetch mindmap-plain.md using cache busting
            const response = await fetch(`/mindmap-plain.md?t=${Date.now()}`);
            if (!response.ok) {
                 if (response.status === 404) {
                     // File not found is common initially, treat as empty
                     console.log("mindmap-plain.md not found, editor will be empty.");
                     setEditorContent('');
                     setStatus(prev => ({ // Keep previous important status or set info
                          message: prev.type === 'error' ? prev.message : 'No existing mindmap content found to load into editor.',
                          type: prev.type === 'error' ? 'error' : 'info'
                     }));
                 } else {
                    throw new Error(`Failed to fetch plain markdown: ${response.statusText}`);
                 }
            } else {
                const mdContent = await response.text();
                setEditorContent(mdContent);
                 setStatus(prev => ({ // Keep previous important status or set success
                     message: prev.type === 'success' || prev.type === 'error' ? prev.message : 'Loaded mindmap content into editor.',
                     type: prev.type === 'success' || prev.type === 'error' ? prev.type : 'success'
                 }));
            }
        } catch (err) {
            console.error('Failed to load editor content:', err);
            setStatus({ message: `Failed to load mindmap content for editor: ${err.message}`, type: 'error' });
            setEditorContent(''); // Clear editor on error
        } finally {
            setIsEditorLoading(false);
        }
    };

    // SAVE editor content (plain markdown) to server
    const handleSaveEditor = async () => {
        const plainMdContent = editorContent; // Content from the textarea state
        if (!plainMdContent.trim()) {
            setStatus({ message: 'Editor is empty. Nothing to save.', type: 'info' });
            return;
        }
        setIsEditorSaving(true);
        setStatus({ message: 'Saving editor content and regenerating mindmap...', type: 'info' });

        try {
            const response = await fetch('/save-md', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Send the PLAIN markdown content from the editor state
                body: JSON.stringify({ mdContent: plainMdContent }),
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || `Server error: ${response.statusText}`);
            }

            setStatus({ message: 'Saved & re-converted successfully! Refreshing view...', type: 'success' });
            setMindmapKey(Date.now()); // Trigger iframe refresh
            setStatus({ message: data.message || 'Editor content saved & mindmap view updated!', type: 'success' });


        } catch (err) {
            console.error('Save failed:', err);
            setStatus({ message: `Save failed: ${err.message}`, type: 'error' });
        } finally {
            setIsEditorSaving(false);
        }
    };

    // --- Effect Hook for Initial Load ---
    // Load existing editor content and ensure iframe loads on component mount
    React.useEffect(() => {
        handleLoadEditor();
        setMindmapKey(Date.now()); // Ensure iframe loads initial state correctly
    }, []); // Empty dependency array = run once on mount

    // --- Render ---
    return (
        // Use flexbox for side-by-side layout that fills viewport height
        <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>

            {/* Left Panel: Controls & Editor */}
            <div style={{ width: '40%', minWidth: '450px', padding: '20px', borderRight: '1px solid #ccc', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                <h1 style={{ flexShrink: 0 }}>Mindmap Generator & Editor</h1>

                {/* Input Form for Generation */}
                <form onSubmit={handleGenerate} style={{ marginBottom: '20px', padding: '15px', border: '1px solid #eee', borderRadius: '5px', backgroundColor: '#f9f9f9', flexShrink: 0 }}>
                    {/* LLM Provider Selection */}
                    <div style={{ marginBottom: '15px' }}>
                        <label htmlFor="providerSelect" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>LLM Provider:</label>
                        <select id="providerSelect" value={selectedProvider} onChange={handleProviderChange} disabled={isLoading} style={{ width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}>
                            {Object.keys(llmOptions).map(provider => (<option key={provider} value={provider}>{provider}</option>))}
                        </select>
                    </div>
                    {/* LLM Model Selection */}
                    <div style={{ marginBottom: '15px' }}>
                        <label htmlFor="modelSelect" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Model:</label>
                        <select id="modelSelect" value={selectedModel} onChange={handleModelChange} disabled={isLoading} style={{ width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}>
                            {llmOptions[selectedProvider].map(model => (<option key={model} value={model}>{model}</option>))}
                        </select>
                    </div>
                    {/* Book Name Input */}
                    <div style={{ marginBottom: '15px' }}>
                          <label htmlFor="bookNameInput" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Book Name:</label>
                          <input type="text" id="bookNameInput" name="bookName" placeholder="e.g., Atomic Habits" value={bookName} onChange={(e) => setBookName(e.target.value)} disabled={isLoading} required style={{ width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }} />
                    </div>
                    {/* Author Name Input */}
                    <div style={{ marginBottom: '15px' }}>
                          <label htmlFor="authorNameInput" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Author Name:</label>
                          <input type="text" id="authorNameInput" name="authorName" placeholder="e.g., James Clear" value={authorName} onChange={(e) => setAuthorName(e.target.value)} disabled={isLoading} required style={{ width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }} />
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading || !bookName.trim() || !authorName.trim()}
                        style={{
                            padding: '10px 15px',
                            cursor: (isLoading || !bookName.trim() || !authorName.trim()) ? 'not-allowed' : 'pointer',
                            backgroundColor: isLoading ? '#ccc' : '#007bff',
                            color: 'white', border: 'none', borderRadius: '4px', fontSize: '1rem'
                        }}
                    >
                        {isLoading ? 'Generating...' : 'Generate Mindmap'}
                    </button>
                </form>

                {/* Status Display */}
                 {status.message && (
                     <div
                         style={{
                             padding: '12px', marginBottom: '15px', borderRadius: '4px', border: '1px solid', flexShrink: 0, // Prevent status shrinking
                             borderColor: status.type === 'error' ? '#f5c6cb' : (status.type === 'success' ? '#c3e6cb' : '#bee5eb'),
                             backgroundColor: status.type === 'error' ? '#f8d7da' : (status.type === 'success' ? '#d4edda' : '#d1ecf1'),
                             color: status.type === 'error' ? '#721c24' : (status.type === 'success' ? '#155724' : '#0c5460'),
                         }}
                         className={`status-message ${status.type}`} // Optional class for more styling
                     >
                         {status.message}
                     </div>
                 )}

                <hr style={{ margin: '20px 0', flexShrink: 0 }}/>

                {/* Editor Section */}
                {/* Use flex-grow to make editor take remaining vertical space */}
                <div className="edit-section" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: '300px' /* Ensure minimum height */ }}>
                    <h2 style={{ flexShrink: 0, marginBottom: '10px' }}>Edit Mindmap Markdown (Plain Text)</h2>
                    <div className="edit-buttons" style={{ marginBottom: '10px', flexShrink: 0 }}>
                        <button
                            onClick={handleLoadEditor}
                            disabled={isEditorLoading || isEditorSaving}
                            style={{ marginRight: '10px', padding: '8px 12px', cursor: (isEditorLoading || isEditorSaving) ? 'wait' : 'pointer' }}
                        >
                            {isEditorLoading ? 'Loading...' : 'Load/Refresh Editor'}
                        </button>
                        <button
                            onClick={handleSaveEditor}
                            disabled={isEditorSaving || isEditorLoading || !editorContent.trim()} // Disable if saving, loading, or empty
                            style={{ padding: '8px 12px', cursor: (isEditorSaving || isEditorLoading || !editorContent.trim()) ? 'not-allowed' : 'pointer', backgroundColor: (isEditorSaving || isEditorLoading) ? '#ccc' : '#28a745', color:'white', border:'none' }}
                        >
                            {isEditorSaving ? 'Saving...' : 'Save & Re-Convert'}
                        </button>
                    </div>
                    {/* Textarea should grow to fill the edit-section */}
                    <div style={{ flexGrow: 1, display: 'flex' }}>
                        <textarea
                            id="md-editor"
                            value={editorContent}
                            onChange={(e) => setEditorContent(e.target.value)}
                            placeholder="Load or edit PLAIN Markdown content here... (Fences ```markdown ... ``` will be added/handled on save/generate)"
                            disabled={isEditorLoading || isEditorSaving}
                            style={{
                                width: '100%',
                                boxSizing: 'border-box', padding: '10px',
                                fontFamily: 'monospace', fontSize: '0.9em',
                                border: '1px solid #ccc', borderRadius: '4px',
                                flexGrow: 1, // Take available vertical space in its container
                                resize: 'none' // Disable manual resize handle if desired
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Right Panel: Mindmap View (Iframe) */}
            <div style={{ width: '60%', height: '100vh', overflow: 'hidden', borderLeft: '1px solid #eee' /* Optional visual separator */ }}>
                 {/* Iframe displaying the mindmap */}
                 <iframe
                    // Use the key prop with the timestamp to force React to re-create the iframe on change
                    key={mindmapKey}
                    // Also include the timestamp in src as a query parameter for robust cache busting
                    src={`/mindmap.html?v=${mindmapKey}`}
                    title="Interactive Mindmap Preview"
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    // sandbox="allow-scripts allow-same-origin" // Consider security implications if uncommenting
                 >
                     Your browser doesn't support iframes. The mindmap cannot be displayed here.
                 </iframe>
            </div>

        </div>
    );
};

// --- Mount the App ---
const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);
root.render(<App />);