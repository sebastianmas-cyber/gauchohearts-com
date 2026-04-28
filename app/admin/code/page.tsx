'use client';

import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { useRouter } from 'next/navigation';

export default function CodePage() {
  const [code, setCode] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('code');
  const router = useRouter();

  useEffect(() => {
    const projectId = localStorage.getItem('editingProjectId');
    const projectCode = localStorage.getItem('editingProjectCode');
    if (projectId && projectCode) {
      setEditingProjectId(projectId);
      setCode(projectCode);
      localStorage.removeItem('editingProjectId');
      localStorage.removeItem('editingProjectCode');
    } else {
      setCode(`<!DOCTYPE html>\n<html>\n<head>\n  <title>HTML Document</title>\n</head>\n<body>\n\n  <h1>My First Heading</h1>\n  <p>My first paragraph.</p>\n\n</body>\n</html>`);
    }
  }, []);

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'index.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    if (editingProjectId) {
      // This is an existing project, save it
      localStorage.setItem('updatedProjectId', editingProjectId);
      localStorage.setItem('updatedProjectCode', code);
      router.push('/admin');
    } else {
      // This is a new project, convert it
      localStorage.setItem('projectCode', code);
      router.push('/admin');
    }
  };

  return (
    <div className="flex flex-col h-screen p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex border-b">
            <button
                className={`px-4 py-2 ${activeTab === 'code' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}`}
                onClick={() => setActiveTab('code')}
            >
                Code
            </button>
            <button
                className={`px-4 py-2 ${activeTab === 'preview' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}`}
                onClick={() => setActiveTab('preview')}
            >
                Preview
            </button>
        </div>
        <div>
            <button
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mr-2"
            onClick={handleSave}
            >
            {editingProjectId ? 'Save Project' : 'Convert to Project'}
            </button>
            <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            onClick={handleDownload}
            >
            Download Code
            </button>
        </div>
      </div>
      <div className="flex-grow border rounded-md overflow-hidden">
        {activeTab === 'code' ? (
            <Editor
            height="100%"
            language="html"
            value={code}
            onChange={(value) => setCode(value || '')}
            theme="vs-light"
            options={{
                minimap: { enabled: true },
                fontSize: 14,
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
            }}
            />
        ) : (
            <iframe
                srcDoc={code}
                title="preview"
                sandbox="allow-scripts"
                width="100%"
                height="100%"
                className="bg-white"
            />
        )}
      </div>
    </div>
  );
}
