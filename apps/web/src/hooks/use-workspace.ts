'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  checkConnectionAction,
  listSessionsAction,
  createSessionAction,
  deleteSessionAction,
  updateSessionAction,
  listMessagesAction,
  sendMessageAction,
  abortSessionAction,
  loadFileTreeAction,
  readFileAction,
  getSessionDiffsAction,
  listModelsAction
} from '@/actions/opencode'
import type {
  WorkspaceFileNode,
  WorkspaceSession,
  WorkspaceMessage,
  WorkspaceConnectionState,
  AvailableModel
} from '@/lib/opencode/types'

export type WorkspaceDiff = {
  path: string
  status: 'modified' | 'added' | 'deleted'
  additions: number
  deletions: number
  diff: string
}

export type UseWorkspaceOptions = {
  slug: string
  /** Poll interval in ms for session status updates */
  pollInterval?: number
}

export type UseWorkspaceReturn = {
  // Connection
  connection: WorkspaceConnectionState
  isConnected: boolean
  
  // Files
  fileTree: WorkspaceFileNode[]
  isLoadingFiles: boolean
  refreshFiles: () => Promise<void>
  readFile: (path: string) => Promise<{ content: string; type: 'raw' | 'patch' } | null>
  
  // Sessions
  sessions: WorkspaceSession[]
  activeSessionId: string | null
  activeSession: WorkspaceSession | null
  isLoadingSessions: boolean
  selectSession: (id: string) => void
  createSession: (title?: string) => Promise<WorkspaceSession | null>
  deleteSession: (id: string) => Promise<boolean>
  renameSession: (id: string, title: string) => Promise<boolean>
  
  // Messages
  messages: WorkspaceMessage[]
  isLoadingMessages: boolean
  isSending: boolean
  sendMessage: (text: string, model?: { providerId: string; modelId: string }) => Promise<void>
  abortSession: () => Promise<void>
  refreshMessages: () => Promise<void>
  
  // Diffs
  diffs: WorkspaceDiff[]
  isLoadingDiffs: boolean
  refreshDiffs: () => Promise<void>
  
  // Models
  models: AvailableModel[]
  selectedModel: AvailableModel | null
  setSelectedModel: (model: AvailableModel | null) => void
}

export function useWorkspace({ slug, pollInterval = 5000 }: UseWorkspaceOptions): UseWorkspaceReturn {
  // Connection state
  const [connection, setConnection] = useState<WorkspaceConnectionState>({ status: 'connecting' })
  
  // Files
  const [fileTree, setFileTree] = useState<WorkspaceFileNode[]>([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  
  // Sessions
  const [sessions, setSessions] = useState<WorkspaceSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  
  // Messages
  const [messages, setMessages] = useState<WorkspaceMessage[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSending, setIsSending] = useState(false)
  
  // Diffs
  const [diffs, setDiffs] = useState<WorkspaceDiff[]>([])
  const [isLoadingDiffs, setIsLoadingDiffs] = useState(false)
  
  // Models
  const [models, setModels] = useState<AvailableModel[]>([])
  const [selectedModel, setSelectedModel] = useState<AvailableModel | null>(null)
  
  const isConnected = connection.status === 'connected'
  
  const activeSession = sessions.find(s => s.id === activeSessionId) ?? null
  
  // Check connection
  const checkConnection = useCallback(async () => {
    const result = await checkConnectionAction(slug)
    setConnection(result)
    return result.status === 'connected'
  }, [slug])
  
  // Load files
  const refreshFiles = useCallback(async () => {
    setIsLoadingFiles(true)
    try {
      const result = await loadFileTreeAction(slug)
      if (result.ok && result.tree) {
        setFileTree(result.tree)
      }
    } finally {
      setIsLoadingFiles(false)
    }
  }, [slug])
  
  // Read single file
  const readFile = useCallback(async (path: string) => {
    const result = await readFileAction(slug, path)
    if (result.ok && result.content) {
      return { content: result.content.content, type: result.content.type }
    }
    return null
  }, [slug])
  
  // Load sessions
  const loadSessions = useCallback(async () => {
    setIsLoadingSessions(true)
    try {
      const result = await listSessionsAction(slug)
      if (result.ok && result.sessions) {
        setSessions(result.sessions)
        
        // Auto-select first session if none selected
        if (!activeSessionId && result.sessions.length > 0) {
          setActiveSessionId(result.sessions[0].id)
        }
      }
    } finally {
      setIsLoadingSessions(false)
    }
  }, [slug, activeSessionId])
  
  // Select session
  const selectSession = useCallback((id: string) => {
    setActiveSessionId(id)
    setMessages([]) // Clear messages when switching sessions
  }, [])
  
  // Create session
  const createSession = useCallback(async (title?: string) => {
    const result = await createSessionAction(slug, title)
    if (result.ok && result.session) {
      setSessions(prev => [result.session!, ...prev])
      setActiveSessionId(result.session.id)
      setMessages([])
      return result.session
    }
    return null
  }, [slug])
  
  // Delete session
  const deleteSession = useCallback(async (id: string) => {
    const result = await deleteSessionAction(slug, id)
    if (result.ok) {
      setSessions(prev => {
        const filtered = prev.filter(s => s.id !== id)
        // Select another session if the deleted one was active
        if (activeSessionId === id && filtered.length > 0) {
          setActiveSessionId(filtered[0].id)
        } else if (filtered.length === 0) {
          setActiveSessionId(null)
        }
        return filtered
      })
      return true
    }
    return false
  }, [slug, activeSessionId])
  
  // Rename session
  const renameSession = useCallback(async (id: string, title: string) => {
    const result = await updateSessionAction(slug, id, title)
    if (result.ok && result.session) {
      setSessions(prev => prev.map(s => s.id === id ? result.session! : s))
      return true
    }
    return false
  }, [slug])
  
  // Load messages for active session
  const refreshMessages = useCallback(async () => {
    if (!activeSessionId) return
    
    setIsLoadingMessages(true)
    try {
      const result = await listMessagesAction(slug, activeSessionId)
      if (result.ok && result.messages) {
        setMessages(result.messages)
      }
    } finally {
      setIsLoadingMessages(false)
    }
  }, [slug, activeSessionId])
  
  // Send message
  const sendMessage = useCallback(async (text: string, model?: { providerId: string; modelId: string }) => {
    if (!activeSessionId) return
    
    // Add optimistic user message
    const tempUserMsg: WorkspaceMessage = {
      id: `temp-${Date.now()}`,
      sessionId: activeSessionId,
      role: 'user',
      content: text,
      timestamp: 'Ahora',
      parts: [{ type: 'text', text }],
      pending: true
    }
    setMessages(prev => [...prev, tempUserMsg])
    
    setIsSending(true)
    try {
      const result = await sendMessageAction(slug, activeSessionId, text, model)
      if (result.ok && result.message) {
        // Replace temp message and add assistant response
        setMessages(prev => {
          const withoutTemp = prev.filter(m => m.id !== tempUserMsg.id)
          // The server returns the assistant message, but we need to also add the user message
          // The assistant message has the actual user message as a preceding entry
          return [...withoutTemp, {
            ...tempUserMsg,
            id: `user-${Date.now()}`,
            pending: false
          }, result.message!]
        })
        
        // Refresh diffs after assistant responds
        refreshDiffs()
      } else {
        // Remove optimistic message on error
        setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id))
      }
    } finally {
      setIsSending(false)
    }
  }, [slug, activeSessionId])
  
  // Abort session
  const abortSession = useCallback(async () => {
    if (!activeSessionId) return
    await abortSessionAction(slug, activeSessionId)
  }, [slug, activeSessionId])
  
  // Load diffs
  const refreshDiffs = useCallback(async () => {
    if (!activeSessionId) return
    
    setIsLoadingDiffs(true)
    try {
      const result = await getSessionDiffsAction(slug, activeSessionId)
      if (result.ok && result.diffs) {
        setDiffs(result.diffs)
      }
    } finally {
      setIsLoadingDiffs(false)
    }
  }, [slug, activeSessionId])
  
  // Load models
  const loadModels = useCallback(async () => {
    const result = await listModelsAction(slug)
    if (result.ok && result.models) {
      setModels(result.models)
      // Auto-select default model
      const defaultModel = result.models.find(m => m.isDefault)
      if (defaultModel) {
        setSelectedModel(defaultModel)
      }
    }
  }, [slug])
  
  // Initial load when connected
  useEffect(() => {
    let mounted = true
    
    async function init() {
      const connected = await checkConnection()
      if (!mounted) return
      
      if (connected) {
        // Load initial data in parallel
        await Promise.all([
          refreshFiles(),
          loadSessions(),
          loadModels()
        ])
      }
    }
    
    init()
    
    return () => { mounted = false }
  }, [checkConnection, refreshFiles, loadSessions, loadModels])
  
  // Load messages when active session changes
  useEffect(() => {
    if (activeSessionId && isConnected) {
      refreshMessages()
      refreshDiffs()
    }
  }, [activeSessionId, isConnected, refreshMessages, refreshDiffs])
  
  // Poll for session status updates
  useEffect(() => {
    if (!isConnected || pollInterval <= 0) return
    
    const interval = setInterval(() => {
      loadSessions()
    }, pollInterval)
    
    return () => clearInterval(interval)
  }, [isConnected, pollInterval, loadSessions])
  
  return {
    connection,
    isConnected,
    fileTree,
    isLoadingFiles,
    refreshFiles,
    readFile,
    sessions,
    activeSessionId,
    activeSession,
    isLoadingSessions,
    selectSession,
    createSession,
    deleteSession,
    renameSession,
    messages,
    isLoadingMessages,
    isSending,
    sendMessage,
    abortSession,
    refreshMessages,
    diffs,
    isLoadingDiffs,
    refreshDiffs,
    models,
    selectedModel,
    setSelectedModel
  }
}
