import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Sparkles, Send, Bot, User, Loader2, AlertCircle, TrendingUp, AlertTriangle, Lightbulb, Shield } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { useAIChat, useAIInsights, useCompanyId } from "@/hooks/useApi"
import toast from "react-hot-toast"
import { useCompanyCurrency, formatCurrencyAmount } from "@/lib/currency"

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const SUGGESTED_QUESTIONS = [
  "What's my current cash flow situation?",
  "What are my top expenses this month?",
  "How is my burn rate trending?",
  "What financial risks should I be aware of?",
  "Show me insights about my revenue",
  "What are my spending patterns?",
]

const getInsightIcon = (type: string) => {
  switch (type) {
    case 'trend':
      return TrendingUp
    case 'anomaly':
      return AlertTriangle
    case 'opportunity':
      return Lightbulb
    case 'risk':
      return Shield
    default:
      return AlertCircle
  }
}

const getInsightColor = (type: string, severity: string) => {
  if (type === 'risk' || severity === 'high') {
    return 'destructive'
  }
  if (type === 'opportunity' || severity === 'low') {
    return 'default'
  }
  return 'secondary'
}

export default function Assistant() {
  const companyId = useCompanyId()
  const { data: currency = 'USD' } = useCompanyCurrency(companyId)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const chatMutation = useAIChat()
  const { data: insights, isLoading: isLoadingInsights, refetch: refetchInsights, error: insightsError } = useAIInsights(companyId)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [input])

  const handleSendMessage = async (query?: string) => {
    const messageText = query || input.trim()

    // Validation
    if (!messageText) {
      toast.error("Please enter a message")
      return
    }

    if (!companyId) {
      toast.error("Please select a company first")
      return
    }

    if (messageText.length > 1000) {
      toast.error("Message is too long. Please keep it under 1000 characters")
      return
    }

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const response = await chatMutation.mutateAsync({
        query: messageText,
        company_id: companyId,
      })

      // Extract answer from response (handle both string and object formats)
      let answerText = ""
      if (typeof response.answer === 'string') {
        answerText = response.answer
      } else if (typeof response.response === 'string') {
        answerText = response.response
      } else if (response.response && typeof response.response === 'object' && response.response.answer) {
        answerText = response.response.answer
      } else {
        answerText = "I'm sorry, I couldn't generate a response. Please try again."
      }

      // Add assistant response
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: answerText,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
      
      // Store follow-up questions if available
      const followUpQuestions = response.follow_up_questions || (response.response && typeof response.response === 'object' ? response.response.follow_up_questions : [])
      if (followUpQuestions && followUpQuestions.length > 0) {
        // Could add follow-up questions to UI later
      }
      
      // Refresh insights after chat
      refetchInsights()
    } catch (error: any) {
      let errorMessage = error?.response?.data?.message || error?.response?.data?.error || error?.message || "Failed to get AI response"
      
      // Provide more user-friendly error messages for common backend errors
      if (errorMessage.includes("can't compare offset-naive and offset-aware datetimes")) {
        errorMessage = "There was a data processing error. Please try refreshing the page and try again. If the issue persists, contact support."
      } else if (errorMessage.includes("Chat failed:")) {
        // Extract the actual error message after "Chat failed:"
        const actualError = errorMessage.split("Chat failed:")[1]?.trim()
        if (actualError) {
          errorMessage = actualError
        }
      }
      
      // Add error message
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMessage}. Please try again.`,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, errorMsg])
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleSuggestedQuestion = (question: string) => {
    setInput(question)
    // Small delay to ensure input is set
    setTimeout(() => {
      handleSendMessage(question)
    }, 100)
  }

  const clearChat = () => {
    setMessages([])
    toast.success("Chat cleared")
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h2 className="text-3xl font-bold tracking-tight">AI Assistant</h2>
          </div>
          <p className="text-muted-foreground">Ask questions about your company finances and get AI-powered insights</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat Section */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="flex flex-col h-[650px]">
            <CardHeader className="shrink-0 border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Chat with AI Assistant</CardTitle>
                    <CardDescription className="mt-0.5">
                      Ask questions about your financial data, cash flow, expenses, and more
                    </CardDescription>
                  </div>
                </div>
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearChat}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Clear Chat
                  </Button>
                )}
              </div>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                    <Bot className="h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">Start a conversation</p>
                    <p className="text-sm mb-6">Ask me anything about your finances</p>
                    
                    {/* Suggested Questions */}
                    <div className="w-full max-w-md space-y-2">
                      <p className="text-xs font-medium mb-2">Suggested questions:</p>
                      <div className="grid grid-cols-1 gap-2">
                        {SUGGESTED_QUESTIONS.map((question, index) => (
                          <Button
                            key={index}
                            variant="outline"
                            size="sm"
                            className="justify-start text-left h-auto py-2 px-3 text-sm"
                            onClick={() => handleSuggestedQuestion(question)}
                          >
                            {question}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${
                          message.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {message.role === 'assistant' && (
                          <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Bot className="h-4 w-4 text-primary" />
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] rounded-lg px-4 py-2 ${
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {message.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                        {message.role === 'user' && (
                          <div className="shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex gap-3 justify-start">
                        <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                        <div className="bg-muted rounded-lg px-4 py-2">
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm text-muted-foreground">Thinking...</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input Area */}
              <div className="shrink-0 border-t bg-muted/20 p-4">
                <div className="flex gap-2">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={companyId ? "Ask a question about your finances..." : "Please select a company to start chatting"}
                    className="min-h-[60px] max-h-[120px] resize-none bg-background"
                    disabled={isLoading || !companyId}
                  />
                  <Button
                    onClick={() => handleSendMessage()}
                    disabled={isLoading || !input.trim() || !companyId}
                    size="icon"
                    className="h-[60px] w-[60px] shrink-0"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </Button>
                </div>
                {!companyId && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <AlertCircle className="h-3 w-3" />
                    <p>Please select a company to start chatting</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Insights Section */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Lightbulb className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">AI Insights</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Automated insights about your financial data
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingInsights ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">Loading insights...</p>
                </div>
              ) : insightsError ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50 text-destructive" />
                  <p className="text-sm text-destructive">Unable to load insights</p>
                  <p className="text-xs mt-1">Please try refreshing the page</p>
                  {!companyId && (
                    <p className="text-xs mt-2 text-amber-600">Please select a company first</p>
                  )}
                </div>
              ) : insights && Array.isArray(insights) && insights.length > 0 ? (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {insights.map((insight, index) => {
                    const Icon = getInsightIcon(insight.type)
                    const color = getInsightColor(insight.type, insight.severity)
                    
                    return (
                      <div
                        key={insight.id || index}
                        className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-1.5 rounded-md bg-primary/10 shrink-0 mt-0.5">
                            <Icon className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <p className="text-sm font-semibold">{insight.title}</p>
                              <Badge variant={color as any} className="text-xs shrink-0">
                                {insight.type}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                              {insight.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No insights available</p>
                  <p className="text-xs mt-1">Insights will appear here as your data grows</p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}
