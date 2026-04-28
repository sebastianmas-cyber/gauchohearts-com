'use client';

import { useFirebase } from '../../firebase/client-provider';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { getFirestore, collection, doc, setDoc, getDocs, getDoc, query, where, serverTimestamp, deleteDoc, orderBy, writeBatch } from "firebase/firestore";
import { useToast } from "@/components/ui/use-toast";

interface Project {
  id: string;
  name: string;
  description: string;
  htmlContent: string | null;
  isChunked?: boolean;
  chunkCount?: number;
  createdAt?: { seconds: number; nanoseconds: number; };
  sandbox?: string;
  allow?: string;
  legacy?: string[];
  visibility?: 'public' | 'unlisted';
}

const sandboxPermissionsList = [
    'allow-downloads',
    'allow-forms',
    'allow-modals',
    'allow-orientation-lock',
    'allow-pointer-lock',
    'allow-popups',
    'allow-popups-to-escape-sandbox',
    'allow-presentation',
    'allow-same-origin',
    'allow-scripts',
    'allow-storage-access-by-user-activation',
    'allow-top-navigation',
    'allow-top-navigation-by-user-activation',
    'allow-top-navigation-to-custom-protocols',
];

const permissionsPolicyList = [
    'accelerometer',
    'ambient-light-sensor',
    'autoplay',
    'battery',
    'camera',
    'ch-device-memory',
    'ch-downlink',
    'ch-dpr',
    'ch-ect',
    'ch-lang',
    'ch-rtt',
    'ch-ua',
    'ch-ua-arch',
    'ch-ua-bitness',
    'ch-ua-full-version-list',
    'ch-ua-mobile',
    'ch-ua-model',
    'ch-ua-platform',
    'ch-ua-platform-version',
    'ch-viewport-height',
    'ch-viewport-width',
    'ch-width',
    'cross-origin-isolated',
    'display-capture',
    'document-domain',
    'document-write',
    'encrypted-media',
    'execution-while-not-rendered',
    'execution-while-out-of-viewport',
    'fullscreen',
    'gamepad',
    'geolocation',
    'gyroscope',
    'hid',
    'identity-credentials-get',
    'idle-detection',
    'layout-animations',
    'lazyload',
    'legacy-image-formats',
    'magnetometer',
    'microphone',
    'midi',
    'navigation-override',
    'oversized-images',
    'payment',
    'picture-in-picture',
    'publickey-credentials-get',
    'screen-wake-lock',
    'serial',
    'speaker-selection',
    'storage-access',
    'summarizer',
    'sync-script',
    'sync-xhr',
    'top-navigation',
    'translator',
    'unoptimized-images',
    'unsized-media',
    'usb',
    'vertical-scroll',
    'view-transition',
    'web-share',
    'window-management',
    'xr-spatial-tracking',
];

const legacyPermissionsList = [
    'allowfullscreen',
    'allowpaymentrequest',
];

export default function AdminPage() {
  const { app, user } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [htmlContent, setHtmlContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('preview');
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState(1);
  const [newProjectFile, setNewProjectFile] = useState<File | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectHtmlContent, setNewProjectHtmlContent] = useState<string | null>(null);
  const [isFromCodeConverter, setIsFromCodeConverter] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingName, setEditingName] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [editingVisibility, setEditingVisibility] = useState<'public' | 'unlisted'>('unlisted');
  const [sandboxPermissions, setSandboxPermissions] = useState<string[]>([]);
  const [allowPermissions, setAllowPermissions] = useState<string[]>([]);
  const [legacyPermissions, setLegacyPermissions] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [showPermissions, setShowPermissions] = useState({ sandbox: true, policy: false, legacy: false });

  useEffect(() => {
    if (user === undefined) {
      setIsLoading(true);
    } else if (user === null) {
      router.push('/login');
    } else {
      setIsLoading(false);
    }
  }, [user, router]);

  useEffect(() => {
    const projectCode = localStorage.getItem('projectCode');
    if (projectCode) {
      setNewProjectHtmlContent(projectCode);
      setNewProjectName('New Project from Code');
      setNewProjectDescription('Converted from code editor.');
      setIsFromCodeConverter(true);
      setIsModalOpen(true);
      setModalStep(2);
      localStorage.removeItem('projectCode');
    }

    const updatedProjectId = localStorage.getItem('updatedProjectId');
    const updatedProjectCode = localStorage.getItem('updatedProjectCode');

    if (updatedProjectId && updatedProjectCode && app && user) {
        const updateProjectCode = async () => {
            setIsSaving(true);
            const db = getFirestore(app);
            const projectRef = doc(db, "projects", updatedProjectId);
            const chunksCollectionRef = collection(db, "projects", updatedProjectId, "htmlChunks");

            try {
                const batch = writeBatch(db);
                const chunkSize = 900 * 1024;

                const existingChunksSnapshot = await getDocs(chunksCollectionRef);
                existingChunksSnapshot.docs.forEach(chunkDoc => {
                    batch.delete(chunkDoc.ref);
                });

                const chunks = [];
                for (let i = 0; i < updatedProjectCode.length; i += chunkSize) {
                    chunks.push(updatedProjectCode.substring(i, i + chunkSize));
                }

                chunks.forEach((chunk, index) => {
                    const chunkRef = doc(chunksCollectionRef, `chunk_${index}`);
                    batch.set(chunkRef, { content: chunk, order: index });
                });

                batch.set(projectRef, { htmlContent: null, isChunked: true, chunkCount: chunks.length }, { merge: true });

                await batch.commit();

                toast({ title: "Success!", description: "Project code updated." });

                localStorage.removeItem('updatedProjectId');
                localStorage.removeItem('updatedProjectCode');

                await fetchProjects();
                const projDoc = await getDoc(projectRef);
                if (projDoc.exists()) {
                    const fetchedProject = { id: projDoc.id, ...projDoc.data() } as Project;
                    await handleSelectProject(fetchedProject);
                    setActiveTab('settings');
                }

            } catch (error) {
                console.error("Error updating project code: ", error);
                toast({ title: "Error Saving", description: "Could not save project code.", variant: "destructive" });
            } finally {
                setIsSaving(false);
            }
        };

        updateProjectCode();
    }
  }, [app, user]);

  const fetchProjects = useCallback(async () => {
    if (isLoading || !user || !app) return;
    const db = getFirestore(app);
    const q = query(collection(db, "projects"), where("owner", "==", user.uid));
    const querySnapshot = await getDocs(q);
    const projectsData = querySnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Project))
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    setProjects(projectsData);
  }, [app, user, isLoading]);

  useEffect(() => {
    if (!isLoading) fetchProjects();
  }, [isLoading, fetchProjects]);

  const openModal = () => {
    setModalStep(1);
    setNewProjectFile(null);
    setNewProjectName('');
    setNewProjectDescription('');
    setNewProjectHtmlContent(null);
    setIsFromCodeConverter(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setNewProjectFile(file);
      setModalStep(2);
    }
  };

  const handleCreateProject = async () => {
    if (!app || !user || (!newProjectFile && !newProjectHtmlContent) || !newProjectName) {
        toast({ title: "Error", description: "Project name and content are required.", variant: "destructive" });
        return;
    }

    const processHtmlContent = async (htmlContent: string) => {
        const db = getFirestore(app);
        
        const projectCollection = collection(db, "projects");
        const projectRef = doc(projectCollection);
        const newProjectId = projectRef.id;

        try {
            const batch = writeBatch(db);

            const newProjectData = {
                name: newProjectName,
                description: newProjectDescription,
                htmlContent: '', 
                isChunked: false,
                chunkCount: 0,
                createdAt: serverTimestamp(),
                owner: user.uid,
                sandbox: 'allow-scripts allow-same-origin',
                allow: '',
                legacy: [],
                visibility: 'unlisted' as 'public' | 'unlisted',
            };
            batch.set(projectRef, newProjectData);

            const chunkSize = 900 * 1024; 
            const chunks = [];
            for (let i = 0; i < htmlContent.length; i += chunkSize) {
                chunks.push(htmlContent.substring(i, i + chunkSize));
            }

            const chunksCollectionRef = collection(db, "projects", newProjectId, "htmlChunks");
            chunks.forEach((chunk, index) => {
                const chunkRef = doc(chunksCollectionRef, `chunk_${index}`);
                batch.set(chunkRef, { content: chunk, order: index });
            });
            
            batch.set(projectRef, {
              isChunked: true,
              chunkCount: chunks.length,
              htmlContent: null
            }, { merge: true });

            await batch.commit();

            const newDocSnap = await getDoc(projectRef);
            if (newDocSnap.exists()) {
                const newProject = { id: newDocSnap.id, ...newDocSnap.data() } as Project;
                setProjects(prevProjects => [newProject, ...prevProjects].sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)));
                await handleSelectProject(newProject);
                toast({ title: "Success!", description: `Project ${newProject.name} has been created.` });
                closeModal();
            } else {
                toast({ title: "Error", description: "Could not find new project after creation. Please refresh.", variant: "destructive" });
                fetchProjects();
            }
        } catch (e: any) {
            toast({ title: "Error Creating Project", description: e.message, variant: "destructive" });
        }
    };

    if (newProjectHtmlContent) {
        await processHtmlContent(newProjectHtmlContent);
    } else if (newProjectFile) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const htmlContent = e.target?.result as string;
            await processHtmlContent(htmlContent);
        };
        reader.readAsText(newProjectFile);
    }
  };

  const handleSelectProject = async (project: Project) => {
    setActiveProject(project);
    setHtmlContent('');

    let fullHtmlContent = '';
    if (project.isChunked) {
        setIsLoading(true);
        if (app) {
            const db = getFirestore(app);
            const chunksCollectionRef = collection(db, "projects", project.id, "htmlChunks");
            const q = query(chunksCollectionRef, orderBy("order"));
            const querySnapshot = await getDocs(q);
            const chunks = querySnapshot.docs.map(doc => doc.data().content);
            fullHtmlContent = chunks.join('');
        }
        setIsLoading(false);
    } else {
      fullHtmlContent = project.htmlContent || '';
    }

    setHtmlContent(fullHtmlContent);
    setEditingName(project.name);
    setEditingDescription(project.description);
    setEditingVisibility(project.visibility || 'unlisted');
    setSandboxPermissions(project.sandbox ? project.sandbox.split(' ') : ['allow-scripts', 'allow-same-origin']);
    setAllowPermissions(project.allow ? project.allow.split(' ') : []);
    setLegacyPermissions(project.legacy || []);
    setActiveTab('preview');
  };

  const handleEditInCodeEditor = () => {
    if (!activeProject) return;
    localStorage.setItem('editingProjectId', activeProject.id);
    localStorage.setItem('editingProjectCode', htmlContent);
    router.push('/admin/code');
  };
  
  const handlePermissionChange = (type: 'sandbox' | 'allow' | 'legacy', permission: string, checked: boolean) => {
    const setter = { sandbox: setSandboxPermissions, allow: setAllowPermissions, legacy: setLegacyPermissions }[type];
    const all = { sandbox: sandboxPermissionsList, allow: permissionsPolicyList, legacy: legacyPermissionsList }[type];
    
    if (permission === 'all') {
        setter(checked ? all : []);
    } else {
        setter(prev => {
            if (checked) {
                return [...prev, permission];
            } else {
                return prev.filter(p => p !== permission);
            }
        });
    }
  };

  const handleUpdateProjectDetails = async () => {
    if (!activeProject || !editingName) return;
    setIsSaving(true);
    const db = getFirestore(app);
    const projectRef = doc(db, "projects", activeProject.id);
    try {
      const updatedDetails = { 
          name: editingName, 
          description: editingDescription,
          visibility: editingVisibility,
          sandbox: sandboxPermissions.join(' '),
          allow: allowPermissions.join(' '),
          legacy: legacyPermissions,
      }; 
      await setDoc(projectRef, updatedDetails, { merge: true });
      const updatedProject = { ...activeProject, ...updatedDetails };
      setActiveProject(updatedProject);
      setProjects(projects => projects.map(p => p.id === updatedProject.id ? updatedProject : p));
      toast({ title: "Success!", description: "Project details have been updated." });
    } catch (error) {
      console.error("Error updating document: ", error);
      toast({ title: "Error", description: "Could not update project details.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleCopyLink = () => {
    if (!activeProject) return;
    const link = `${window.location.origin}/project?id=${activeProject.id}`;

    const fallbackCopy = () => {
      const textArea = document.createElement("textarea");
      textArea.value = link;
      textArea.style.position = "absolute";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        toast({ title: "Copied!", description: "Project link copied to clipboard." });
      } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
        toast({ title: "Error", description: "Failed to copy link.", variant: "destructive" });
      }
      document.body.removeChild(textArea);
    };

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(link).then(function() {
            toast({ title: "Copied!", description: "Project link copied to clipboard." });
        }, function(err) {
            console.error('Async: Could not copy text: ', err);
            fallbackCopy();
        });
    } else {
        fallbackCopy();
    }
  };
  
  const handleDeleteProject = async () => {
    if (!activeProject) return;

    setIsDeleteDialogOpen(false);
    const db = getFirestore(app);
    const projectRef = doc(db, "projects", activeProject.id);
    try {
      await deleteDoc(projectRef);
      toast({ title: "Success!", description: `Project ${activeProject.name} has been deleted.` });
      setActiveProject(null);
      fetchProjects();
    } catch (error) {
      console.error("Error deleting document: ", error);
      toast({ title: "Error", description: "Could not delete project.", variant: "destructive" });
    }
  };
  
  const togglePermissions = (type: 'sandbox' | 'policy' | 'legacy') => {
    setShowPermissions(prev => ({ ...prev, [type]: !prev[type] }));
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><p>Loading...</p></div>;
  }

  return (
    <>
      {isModalOpen && (
        <div className="fixed inset-0 bg-[rgba(0,0,0,0.5)] z-40 flex justify-center items-center">
          <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
            {modalStep === 1 && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Step 1: Upload a File</h2>
                <p className="mb-6 text-gray-600">Select the main HTML file for your new project.</p>
                <input type="file" accept=".html" onChange={handleFileSelect} className="hidden" ref={fileInputRef} />
                <button onClick={() => fileInputRef.current?.click()} className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded cursor-pointer">
                  Choose File
                </button>
                <button onClick={closeModal} className="mt-2 w-full text-center text-sm text-gray-500 hover:underline">Cancel</button>
              </div>
            )}
            {modalStep === 2 && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Step 2: Project Details</h2>
                <p className="mb-6 text-gray-600">Provide a name and an optional description for your project.</p>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="projectName">Project Name</label>
                  <input type="text" id="projectName" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="My Awesome Project" className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"/>
                </div>
                <div className="mb-6">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="projectDescription">Description (Optional)</label>
                  <textarea id="projectDescription" value={newProjectDescription} onChange={(e) => setNewProjectDescription(e.target.value)} placeholder="A brief description of what this project is about." className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700" rows={3}></textarea>
                </div>
                <div className="flex justify-between items-center">
                  {!isFromCodeConverter && <button onClick={() => setModalStep(1)} className="text-sm text-gray-500 hover:underline">Back</button>}
                  <div>
                    <button onClick={closeModal} className="text-sm text-gray-500 hover:underline mr-4">Cancel</button>
                    <button onClick={handleCreateProject} className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded cursor-pointer" disabled={!newProjectName}>Create Project</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isDeleteDialogOpen && (
        <div className="fixed inset-0 bg-[rgba(0,0,0,0.5)] z-50 flex justify-center items-center">
            <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
                <h2 className="text-2xl font-bold mb-4">Delete Project</h2>
                <p className="mb-6 text-gray-600">Are you sure you want to delete the project "{activeProject?.name}"? This action cannot be undone.</p>
                <div className="flex justify-end items-center">
                    <button onClick={() => setIsDeleteDialogOpen(false)} className="text-sm text-gray-500 hover:underline mr-4">Cancel</button>
                    <button onClick={handleDeleteProject} className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded cursor-pointer">Delete</button>
                </div>
            </div>
        </div>
      )}

      <div className="flex h-screen bg-gray-50">
        <div className="w-1/3 border-r bg-white flex flex-col">
            <div className="p-4 border-b">
                <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Projects</h1>
                <button type="button" onClick={() => setActiveProject(null)} className="text-sm text-blue-500 hover:underline">View All</button>
                </div>
                <button type="button" onClick={openModal} className="mt-4 w-full bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded cursor-pointer">New Project</button>
            </div>
            <ul className="p-2 space-y-1 overflow-y-auto">
                {projects.map(p => (
                <li key={p.id} onClick={() => handleSelectProject(p)} 
                    className={`p-3 rounded-lg cursor-pointer flex justify-between items-center ${activeProject?.id === p.id ? 'bg-blue-100' : 'hover:bg-gray-100'}`}>
                    <span className="font-medium truncate">{p.name || p.id}</span>
                    <a href={`/project?id=${p.id}`} target="_blank" rel="noopener noreferrer" 
                    onClick={(e) => e.stopPropagation()} 
                    className="text-blue-500 hover:underline text-sm ml-2">
                    View
                    </a>
                </li>
                ))}
            </ul>
        </div>

        <div className="w-2/3 flex flex-col">
          {!activeProject ? (
            <div className="flex-grow flex items-center justify-center text-gray-500">
              <p>Select a project from the left, or create a new one.</p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex border-b bg-white">
                  <button onClick={() => setActiveTab('preview')} className={`py-3 px-6 font-semibold ${activeTab === 'preview' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}>Preview</button>
                  <button onClick={() => setActiveTab('settings')} className={`py-3 px-6 font-semibold ${activeTab === 'settings' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}>Settings</button>
              </div>
              <div className="flex-grow overflow-y-auto">
                <div className="p-4 h-full">
                    {activeTab === 'preview' && (
                    <iframe
                        className="w-full h-full border rounded-md bg-white"
                        srcDoc={htmlContent}
                        sandbox={sandboxPermissions.join(' ')}
                        allow={allowPermissions.join(' ')}
                        {...legacyPermissions.reduce((acc, p) => ({...acc, [p]: true}), {})}
                        title="Project Preview"
                    />
                    )}
                    {activeTab === 'settings' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-bold">Settings</h3>
                            <button 
                                onClick={handleEditInCodeEditor}
                                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out"
                            >
                                Edit in Code Editor
                            </button>
                        </div>
                        <div className="mb-6">
                            <label htmlFor="projectLink" className="block text-gray-700 text-sm font-bold mb-2">Project Link</label>
                            <div className="flex items-center space-x-2">
                                <input
                                    id="projectLink"
                                    type="text"
                                    readOnly
                                    value={`${window.location.origin}/project?id=${activeProject.id}`}
                                    onClick={handleCopyLink}
                                    className="shadow-sm appearance-none border rounded w-full py-2 px-3 text-gray-700 bg-gray-50 leading-tight focus:outline-none focus:shadow-outline cursor-pointer"
                                    title="Click to copy"
                                />
                                <a
                                    href={`/project?id=${activeProject.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold p-2.5 rounded focus:outline-none focus:shadow-outline"
                                    title="Open in new tab"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </a>
                            </div>
                        </div>
                        <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="editingProjectName">Project Name</label>
                        <input type="text" id="editingProjectName" value={editingName} onChange={(e) => setEditingName(e.target.value)} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"/>
                        </div>
                        <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="editingProjectDescription">Description</label>
                        <textarea id="editingProjectDescription" value={editingDescription} onChange={(e) => setEditingDescription(e.target.value)} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" rows={3}></textarea>
                        </div>
                        <div className="mb-6">
                            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="editingVisibility">Visibility</label>
                            <select 
                                id="editingVisibility" 
                                value={editingVisibility} 
                                onChange={(e) => setEditingVisibility(e.target.value as 'public' | 'unlisted')} 
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            >
                                <option value="unlisted">Unlisted</option>
                                <option value="public">Public</option>
                            </select>
                            <p className="text-xs text-gray-600 mt-1">'Public' projects are listed on the /all page. 'Unlisted' projects are only accessible via direct link.</p>
                        </div>

                        <div className="mt-8">
                            <h3 className="text-lg font-bold mb-2">Embed Settings</h3>
                            <div className="p-4 border rounded-md">
                                <h4 className="font-semibold mb-2">Permissions</h4>
                                <p className="text-sm text-gray-600 mb-4">Control what the embedded project can do.</p>

                                <div className="border rounded-md mt-4">
                                    <div className="cursor-pointer p-4" onClick={() => togglePermissions('sandbox')}>
                                        <h5 className="font-semibold">Sandbox Restrictions {showPermissions.sandbox ? '\u25B2' : '\u25BC'}</h5>
                                    </div>
                                    {showPermissions.sandbox && (
                                        <div className="space-y-2 p-4 border-t">
                                            <label className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    checked={sandboxPermissions.length === sandboxPermissionsList.length}
                                                    onChange={(e) => handlePermissionChange('sandbox', 'all', e.target.checked)}
                                                />
                                                <span className="ml-2 text-sm font-bold text-gray-700">Allow All</span>
                                            </label>
                                            <hr className="my-2"/>
                                            <div className="grid grid-cols-2 gap-2">
                                                {sandboxPermissionsList.map(permission => (
                                                    <label key={permission} className="flex items-center">
                                                        <input
                                                            type="checkbox"
                                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                            checked={sandboxPermissions.includes(permission)}
                                                            onChange={(e) => handlePermissionChange('sandbox', permission, e.target.checked)}
                                                        />
                                                        <span className="ml-2 text-sm text-gray-700">{permission}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="border rounded-md mt-4">
                                    <div className="cursor-pointer p-4" onClick={() => togglePermissions('policy')}>
                                        <h5 className="font-semibold">Permissions Policy {showPermissions.policy ? '\u25B2' : '\u25BC'}</h5>
                                    </div>
                                    {showPermissions.policy && (
                                        <div className="space-y-2 p-4 border-t">
                                            <label className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    checked={allowPermissions.length === permissionsPolicyList.length}
                                                    onChange={(e) => handlePermissionChange('allow', 'all', e.target.checked)}
                                                />
                                                <span className="ml-2 text-sm font-bold text-gray-700">Allow All</span>
                                            </label>
                                            <hr className="my-2"/>
                                            <div className="grid grid-cols-2 gap-2">
                                                {permissionsPolicyList.map(permission => (
                                                    <label key={permission} className="flex items-center">
                                                        <input
                                                            type="checkbox"
                                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                            checked={allowPermissions.includes(permission)}
                                                            onChange={(e) => handlePermissionChange('allow', permission, e.target.checked)}
                                                        />
                                                        <span className="ml-2 text-sm text-gray-700">{permission}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="border rounded-md mt-4">
                                    <div className="cursor-pointer p-4" onClick={() => togglePermissions('legacy')}>
                                        <h5 className="font-semibold">Other Legacy Attributes {showPermissions.legacy ? '\u25B2' : '\u25BC'}</h5>
                                    </div>
                                    {showPermissions.legacy && (
                                        <div className="space-y-2 p-4 border-t">
                                            <div className="grid grid-cols-2 gap-2">
                                                {legacyPermissionsList.map(permission => (
                                                    <label key={permission} className="flex items-center">
                                                        <input
                                                            type="checkbox"
                                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                            checked={legacyPermissions.includes(permission)}
                                                            onChange={(e) => handlePermissionChange('legacy', permission, e.target.checked)}
                                                        />
                                                        <span className="ml-2 text-sm text-gray-700">{permission}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <button onClick={handleUpdateProjectDetails} className="mt-6 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline" disabled={isSaving || (editingName === activeProject.name && editingDescription === activeProject.description && editingVisibility === (activeProject.visibility || 'unlisted') && sandboxPermissions.join(' ') === (activeProject.sandbox || '') && allowPermissions.join(' ') === (activeProject.allow || '') && legacyPermissions.join(' ') === (activeProject.legacy?.join(' ') || ''))}>
                        {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                        
                        <div className="mt-8 pt-8 border-t border-gray-200">
                            <h3 className="text-lg font-bold text-red-500 mb-2">Danger Zone</h3>
                            <div className="p-4 border border-red-500 rounded-md">
                                <p className="text-sm text-gray-600 mb-4">Once you delete a project, there is no going back. Please be certain you want to delete it.</p>
                                <button onClick={() => setIsDeleteDialogOpen(true)} className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
                                    Delete Project
                                </button>
                            </div>
                        </div>

                    </div>
                    )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
