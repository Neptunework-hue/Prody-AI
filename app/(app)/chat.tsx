import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, Image, KeyboardAvoidingView, Platform, FlatList, Modal as RNModal, Animated, Easing, TouchableOpacity, Alert, AppState, AppStateStatus, Keyboard } from 'react-native';
import { Text, Button, TextInput, IconButton, Avatar, useTheme } from 'react-native-paper';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import BottomNavBar, { BOTTOM_NAV_TOTAL_HEIGHT } from '../../components/BottomNavBar';
import { offlineTaskService } from '../../services/offline/taskService';
import { useAuth } from '../../hooks/useAuth';
import * as Speech from 'expo-speech';
import OfflineIndicator from '../../components/OfflineIndicator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Task, TaskCreate, TaskPriority } from '../../types/task';

// Dummy bot image import (user should place the image at ProdyAI/assets/prody-bot.png)
const botImage = require('../../assets/prody-bot.png');

const BOT_NAME = 'PRODY';

type ChatMessage = {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  loading?: boolean;
  suggestions?: string[];
};

const initialMessages: ChatMessage[] = [
  { id: '1', sender: 'bot', text: 'Hi! I am Prody. How can I help you today?\n\nI can:\n• Create tasks and add them to your calendar\n• Break down complex tasks into subtasks using AI\n• Update existing tasks\n• Help you plan your schedule\n\nTry saying: "Create subtasks for my project" or "Break down my homework" to get AI-generated subtasks!' },
];

// DeepSeek API integration
const DEEPSEEK_API_KEY = 'sk-0626ab8a919d49c9ab05abae965dd337';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// Optimized API configuration for faster responses
const API_CONFIG = {
  model: 'deepseek-chat',
  temperature: 0.3, // Reduced from 0.7 for faster, more focused responses
  max_tokens: 500, // Reduced from 1000 to limit response length
  top_p: 0.9, // Add top_p for more focused sampling
  frequency_penalty: 0.1, // Reduce repetition
  presence_penalty: 0.1, // Encourage new topics
  timeout: 10000 // 10 second timeout
};

// Height of the chat input bar (approx.) used for spacing the message list
const INPUT_BAR_HEIGHT = 72;

// Tool schemas for DeepSeek function calling
const TOOL_SCHEMAS = [
  {
    type: "function",
    function: {
      name: 'createTask',
      description: 'Create a new task for the user. If a date or time is provided, add it to the calendar.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Task title' },
          description: { type: 'string', description: 'Task details' },
          deadline: { type: 'string', format: 'date', description: 'Date for the task (optional, adds to calendar)' },
          startTime: { type: 'string', format: 'date-time', description: 'Start time for the task (optional)' },
          endTime: { type: 'string', format: 'date-time', description: 'End time for the task (optional)' }
        },
        required: ['title']
      }
    }
  },
  {
    type: "function",
    function: {
      name: 'createSubtasks',
      description: 'Create subtasks for an existing task. Break down a complex task into smaller, manageable subtasks.',
      parameters: {
        type: 'object',
        properties: {
          parentTaskTitle: { type: 'string', description: 'Title of the parent task to add subtasks to' },
          subtasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Subtask title' },
                description: { type: 'string', description: 'Subtask details' },
                priority: { type: 'number', description: 'Priority level (0-3, where 0=Low, 1=Medium, 2=High, 3=Urgent)' }
              },
              required: ['title']
            }
          }
        },
        required: ['parentTaskTitle', 'subtasks']
      }
    }
  },
  {
    type: "function",
    function: {
      name: 'createTasks',
      description: 'Create multiple tasks for breaking down a problem or project. If dates are provided, add them to the calendar.',
      parameters: {
        type: 'object',
        properties: {
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Task title' },
                description: { type: 'string', description: 'Task details' },
                deadline: { type: 'string', format: 'date', description: 'Date for the task (optional, adds to calendar)' },
                startTime: { type: 'string', format: 'date-time', description: 'Start time for the task (optional)' },
                endTime: { type: 'string', format: 'date-time', description: 'End time for the task (optional)' }
              },
              required: ['title']
            }
          }
        },
        required: ['tasks']
      }
    }
  },
  {
    type: "function",
    function: {
      name: 'updateTask',
      description: 'Update an existing task.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          deadline: { type: 'string', format: 'date' },
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' },
          starttime: { type: 'string', format: 'date-time' },
          endtime: { type: 'string', format: 'date-time' },
          status: { type: 'string' }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: 'proposeSchedule',
      description: 'Propose a study or work schedule for the user based on their input.',
      parameters: {
        type: 'object',
        properties: {
          details: { type: 'string' }
        },
        required: ['details']
      }
    }
  },
  {
    type: "function",
    function: {
      name: 'confirmSchedule',
      description: 'Confirm and create/update all tasks/events in the proposed schedule.',
      parameters: {
        type: 'object',
        properties: {
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                deadline: { type: 'string', format: 'date' },
                starttime: { type: 'string', format: 'date-time' },
                endtime: { type: 'string', format: 'date-time' }
              },
              required: ['title']
            }
          }
        },
        required: ['tasks']
      }
    }
  },
  {
    type: "function",
    function: {
      name: 'getTasks',
      description: 'Get a list of the user\'s current tasks.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: 'getCalendarEvents',
      description: 'Get a list of the user\'s current calendar events (tasks with dates).',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  }
];

// Simple test function to verify function calling works
const TEST_FUNCTIONS = [
  {
    name: 'test_function',
    description: 'A simple test function',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'A test message' }
      },
      required: ['message']
    }
  }
];

// Simple regex-based date parser
function parseSimpleDate(userMessage: string): string | undefined {
  const msg = userMessage.toLowerCase();
  const today = new Date();
  // today
  if (/\btoday\b/.test(msg)) {
    return today.toISOString().split('T')[0];
  }
  // tomorrow
  if (/\btomorrow\b/.test(msg)) {
    const tmr = new Date(today);
    tmr.setDate(today.getDate() + 1);
    return tmr.toISOString().split('T')[0];
  }
  // on YYYY-MM-DD
  const isoMatch = msg.match(/on (\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    return isoMatch[1];
  }
  // on Month Day (e.g., on July 20)
  const monthDayMatch = msg.match(/on ([a-zA-Z]+) (\d{1,2})/);
  if (monthDayMatch) {
    const month = monthDayMatch[1];
    const day = parseInt(monthDayMatch[2], 10);
    const year = today.getFullYear();
    const date = new Date(`${month} ${day}, ${year}`);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  return undefined;
}

// Enhanced regex-based time and priority parser
function parseTimeAndPriority(userMessage: string, deadline?: string): { starttime?: string, endtime?: string, priority?: number } {
  const msg = userMessage.toLowerCase();
  let starttime: string | undefined;
  let endtime: string | undefined;
  let priority: number | undefined;

  // Time extraction (e.g., at 8pm, at 14:30, from 2pm to 3pm)
  // 1. Range: from X to Y
  const rangeMatch = msg.match(/from (\d{1,2})(?::(\d{2}))?\s*(am|pm)? to (\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (rangeMatch && deadline) {
    const [ , sh, sm, sap, eh, em, eap ] = rangeMatch;
    const date = deadline;
    const startHour = sap ? to24Hour(parseInt(sh), sap) : parseInt(sh);
    const endHour = eap ? to24Hour(parseInt(eh), eap) : parseInt(eh);
    const startMinute = sm ? parseInt(sm) : 0;
    const endMinute = em ? parseInt(em) : 0;
    starttime = `${date}T${pad(startHour)}:${pad(startMinute)}:00`;
    endtime = `${date}T${pad(endHour)}:${pad(endMinute)}:00`;
  } else {
    // 2. Single time: at X
    const singleMatch = msg.match(/at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (singleMatch && deadline) {
      const [ , h, m, ap ] = singleMatch;
      const date = deadline;
      const hour = ap ? to24Hour(parseInt(h), ap) : parseInt(h);
      const minute = m ? parseInt(m) : 0;
      starttime = `${date}T${pad(hour)}:${pad(minute)}:00`;
    }
  }

  // Priority extraction
  if (/\burgent\b|asap|immediately/.test(msg)) priority = 3;
  else if (/\bhigh priority\b|very important|critical/.test(msg)) priority = 2;
  else if (/\bmedium priority\b|normal priority/.test(msg)) priority = 1;
  else if (/\blow priority\b|not urgent|not important/.test(msg)) priority = 0;

  return { starttime, endtime, priority };
}
function to24Hour(hour: number, ampm: string) {
  if (ampm === 'pm' && hour < 12) return hour + 12;
  if (ampm === 'am' && hour === 12) return 0;
  return hour;
}
function pad(n: number) { return n.toString().padStart(2, '0'); }

// Text-based task extraction system
function extractTaskFromResponse(userMessage: string, aiResponse: string): { title: string; description: string; deadline?: string; starttime?: string; endtime?: string; priority?: number } | null {
  const userMsgLower = userMessage.toLowerCase();
  const aiResponseLower = aiResponse.toLowerCase();
  
  // Check if user is asking to create a task
  const taskKeywords = ['create task', 'add task', 'new task', 'make task', 'add to tasks', 'remind me', 'reminder', 'schedule', 'todo'];
  const isTaskRequest = taskKeywords.some(keyword => userMsgLower.includes(keyword));
  
  // Enhanced implicit task patterns with better context
  const implicitTaskPatterns = [
    /(tidy|clean|organize|sort|arrange)\s+([a-z\s]+)/i,
    /(study|read|write|work on|finish|complete)\s+([a-z\s]+)/i,
    /(buy|purchase|get|pick up)\s+([a-z\s]+)/i,
    /(call|text|email|message|contact)\s+([a-z\s]+)/i,
    /(meet|meeting with|appointment with)\s+([a-z\s]+)/i,
    /(go to|visit|attend|travel to)\s+([a-z\s]+)/i,
    /(cook|prepare|make)\s+([a-z\s]+)/i,
    /(exercise|workout|run|jog|walk)\s+([a-z\s]*)/i,
    /(review|check|examine)\s+([a-z\s]+)/i,
    /(submit|send|upload)\s+([a-z\s]+)/i
  ];
  
  const implicitTaskMatch = implicitTaskPatterns.find(pattern => pattern.test(userMessage));
  const hasImplicitTask = !!implicitTaskMatch;
  
  console.log('Task extraction check:', { 
    userMessage, 
    isTaskRequest, 
    hasImplicitTask,
    taskKeywords: taskKeywords.filter(k => userMsgLower.includes(k)),
    implicitMatch: implicitTaskMatch ? implicitTaskMatch[0] : null
  });
  
  if (!isTaskRequest && !hasImplicitTask) return null;
  
  // Extract deadline using simple regex parser
  const deadline = parseSimpleDate(userMessage);
  // Extract time and priority
  const { starttime, endtime, priority } = parseTimeAndPriority(userMessage, deadline);
  
  // Try to extract task title from user message
  let title = '';
  let description = '';
  
  // First, try to extract from implicit task patterns
  if (implicitTaskMatch) {
    const match = userMessage.match(implicitTaskMatch);
    if (match && match[0]) {
      const action = match[1]; // e.g., "call", "clean", "study"
      const target = match[2]; // e.g., "yassen", "room", "math"
      
      // Create a more descriptive title
      title = `${action} ${target}`.trim();
      
      // Create a rich, descriptive description
      const descriptionParts = [];
      
      // Add context from the original message
      const originalContext = userMessage.replace(implicitTaskMatch, '').trim();
      if (originalContext) {
        descriptionParts.push(originalContext);
      }
      
      // Add time details
      const timeDetails = [];
      if (deadline) {
        const date = new Date(deadline);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        
        if (date.toDateString() === today.toDateString()) {
          timeDetails.push('today');
        } else if (date.toDateString() === tomorrow.toDateString()) {
          timeDetails.push('tomorrow');
        } else {
          timeDetails.push(`on ${date.toLocaleDateString()}`);
        }
      }
      
      if (starttime && endtime) {
        const start = new Date(starttime);
        const end = new Date(endtime);
        timeDetails.push(`from ${start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} to ${end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`);
      } else if (starttime) {
        const start = new Date(starttime);
        timeDetails.push(`at ${start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`);
      }
      
      // Add priority context
      if (priority !== undefined) {
        const priorityText = ['Low', 'Medium', 'High', 'Urgent'][priority];
        timeDetails.push(`Priority: ${priorityText}`);
      }
      
      // Combine all parts for a rich description
      if (timeDetails.length > 0) {
        descriptionParts.push(`Schedule: ${timeDetails.join(', ')}`);
      }
      
      // Add action-specific context
      const actionContext = {
        'call': 'Make sure to have all necessary information ready before calling',
        'text': 'Send a clear and concise message',
        'email': 'Draft a professional email with all relevant details',
        'meet': 'Prepare agenda and any materials needed for the meeting',
        'study': 'Find a quiet place and gather all study materials',
        'work on': 'Set aside dedicated time and minimize distractions',
        'clean': 'Gather cleaning supplies and plan the cleaning approach',
        'buy': 'Check if you have the budget and make a shopping list',
        'cook': 'Gather ingredients and check recipe requirements',
        'exercise': 'Wear appropriate clothing and warm up properly'
      };
      
      if (actionContext[action.toLowerCase()]) {
        descriptionParts.push(actionContext[action.toLowerCase()]);
      }
      
      // Combine all description parts
      if (descriptionParts.length > 0) {
        description = descriptionParts.join('. ');
      } else {
        description = `Complete the task: ${action} ${target}`;
      }
    }
  }
  
  // If no title from implicit patterns, try explicit patterns
  if (!title) {
    // Look for patterns like "create task called X" or "add task X"
    const titlePatterns = [
      /create task (?:called |named |)?["']?([^"']+)["']?/i,
      /add task (?:called |named |)?["']?([^"']+)["']?/i,
      /new task (?:called |named |)?["']?([^"']+)["']?/i,
      /make task (?:called |named |)?["']?([^"']+)["']?/i,
      /task (?:called |named |)?["']?([^"']+)["']?/i,
      /remind me to (["']?[^"']+["']?)/i,
      /reminder to (["']?[^"']+["']?)/i,
      /schedule (["']?[^"']+["']?)/i,
      /add (["']?[^"']+["']?) to my tasks/i
    ];
    
    for (const pattern of titlePatterns) {
      const match = userMessage.match(pattern);
      if (match && match[1]) {
        title = match[1].trim();
        break;
      }
    }
  }
  
  // If no title found, try to extract from AI response
  if (!title) {
    // Look for quoted text in AI response
    const quotedMatch = aiResponse.match(/["']([^"']+)["']/);
    if (quotedMatch) {
      title = quotedMatch[1].trim();
    }
  }
  
  // If still no title, create a clean title from the user message
  if (!title) {
    // Remove time/date words and create a clean title
    const cleanMessage = userMessage
      .replace(/\b(today|tomorrow|yesterday|morning|afternoon|evening|night|am|pm|at|from|to|between|until|by)\b/gi, '')
      .replace(/\b\d{1,2}:\d{2}\b/g, '')
      .replace(/\b\d{1,2}\s*(am|pm)\b/gi, '')
      .replace(/\bon\s+\w+\s+\d{1,2}\b/gi, '')
      .replace(/\bon\s+\d{4}-\d{2}-\d{2}\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    title = cleanMessage;
  }
  
  // If we still don't have a description, create a comprehensive one
  if (!description) {
    const descriptionParts = [];
    
    // Add the original user message as context
    descriptionParts.push(`Task: ${userMessage}`);
    
    // Add time details
    const timeDetails = [];
    if (deadline) {
      const date = new Date(deadline);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      
      if (date.toDateString() === today.toDateString()) {
        timeDetails.push('today');
      } else if (date.toDateString() === tomorrow.toDateString()) {
        timeDetails.push('tomorrow');
      } else {
        timeDetails.push(`on ${date.toLocaleDateString()}`);
      }
    }
    
    if (starttime && endtime) {
      const start = new Date(starttime);
      const end = new Date(endtime);
      timeDetails.push(`from ${start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} to ${end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`);
    } else if (starttime) {
      const start = new Date(starttime);
      timeDetails.push(`at ${start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`);
    }
    
    if (timeDetails.length > 0) {
      descriptionParts.push(`Schedule: ${timeDetails.join(', ')}`);
    }
    
    // Add priority context
    if (priority !== undefined) {
      const priorityText = ['Low', 'Medium', 'High', 'Urgent'][priority];
      descriptionParts.push(`Priority: ${priorityText}`);
    }
    
    // Add AI response context if available
    if (aiResponse && aiResponse !== 'Sorry, I could not get a response from the AI.') {
      descriptionParts.push(`Notes: ${aiResponse}`);
    }
    
    description = descriptionParts.join('. ');
  }

  console.log('Extracted task info:', { title, description, deadline, starttime, endtime, priority });
  
  return { title, description, deadline, starttime, endtime, priority };
}

// Detect update intent
function isUpdateIntent(userMessage: string): boolean {
  return /(change|update|edit|move|reschedule|make|set|modify)\b/i.test(userMessage);
}

// Add a ref to store the last created/updated task
let lastBotTask: { id: string, title: string } | null = null;

// Extract task title for update (looks for quoted text or after keywords)
function extractTaskTitleForUpdate(userMessage: string): string | undefined {
  const contextualPhrases = [
    'the last task', 'the task you just made', 'the task you just created', 'that one', 'the recent task', 'the previous task', 'the latest task', 'the new task', 'the one you just made', 'the one you just created', 'it', 'this task', 'that task'
  ];
  for (const phrase of contextualPhrases) {
    if (userMessage.toLowerCase().includes(phrase)) {
      return 'CONTEXTUAL_REFERENCE';
    }
  }
  // Try quoted
  const quoted = userMessage.match(/['"]([^'"]+)['"]/);
  if (quoted) return quoted[1];
  
  // Try after keywords - improved regex to capture more text
  const match = userMessage.match(/(?:change|update|edit|move|reschedule|make|set|modify)\s+(.+?)(?:\s+to\s+|\s+as\s+|\s+with\s+|\s+priority\s+|\s+deadline\s+|\s+time\s+|\s+description\s+|\s+status\s+|\s+$)/i);
  if (match) {
    const extracted = match[1].trim();
    // Handle contextual references
    if (extracted.toLowerCase().includes('the task') || 
        extracted.toLowerCase().includes('last task') || 
        extracted.toLowerCase().includes('recent task') ||
        extracted.toLowerCase().includes('it just made') ||
        extracted.toLowerCase().includes('just created')) {
      return 'CONTEXTUAL_REFERENCE'; // Special marker for contextual reference
    }
    return extracted;
  }
  
  return undefined;
}

// Detect subtask intent
function isSubtaskIntent(userMessage: string): boolean {
  const subtaskKeywords = [
    'subtask', 'break down', 'divide', 'split', 'decompose', 'break into', 
    'create subtasks', 'make subtasks', 'add subtasks', 'subtasks for',
    'break this down', 'divide this', 'split this', 'decompose this'
  ];
  return subtaskKeywords.some(keyword => userMessage.toLowerCase().includes(keyword));
}

// AI-powered subtask generation using DeepSeek API
async function generateSubtasksWithAI(parentTaskTitle: string, parentTaskDescription: string, userId: string): Promise<{ title: string; description: string; priority: number }[]> {
  try {
    const prompt = `Please break down the following task into 3-7 logical subtasks that would help complete it effectively:

Task: ${parentTaskTitle}
Description: ${parentTaskDescription || 'No description provided'}

Please create subtasks that are:
1. Specific and actionable
2. Logical steps toward completing the main task
3. Appropriately sized (not too big or too small)
4. Clear and easy to understand

Return the subtasks in a structured format.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: API_CONFIG.model,
        messages: [
          { role: 'system', content: 'You are a productivity expert who specializes in breaking down complex tasks into manageable subtasks. Always respond with clear, actionable subtasks.' },
          { role: 'user', content: prompt }
        ],
        temperature: API_CONFIG.temperature,
        max_tokens: API_CONFIG.max_tokens,
        top_p: API_CONFIG.top_p,
        frequency_penalty: API_CONFIG.frequency_penalty,
        presence_penalty: API_CONFIG.presence_penalty
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || '';

    // Parse the AI response to extract subtasks
    const subtasks = parseSubtasksFromAIResponse(aiResponse);
    return subtasks;
  } catch (error) {
    console.error('AI subtask generation error:', error);
    // Fallback to basic subtasks
    return [
      { title: `Research ${parentTaskTitle}`, description: 'Gather information and resources needed', priority: 1 },
      { title: `Plan ${parentTaskTitle}`, description: 'Create a detailed plan and timeline', priority: 1 },
      { title: `Execute ${parentTaskTitle}`, description: 'Implement the main task', priority: 2 },
      { title: `Review ${parentTaskTitle}`, description: 'Review and refine the completed work', priority: 1 }
    ];
  }
}

// Parse subtasks from AI response
function parseSubtasksFromAIResponse(aiResponse: string): { title: string; description: string; priority: number }[] {
  const subtasks: { title: string; description: string; priority: number }[] = [];
  
  // Try to extract numbered or bulleted lists
  const lines = aiResponse.split('\n');
  let currentSubtask: { title: string; description: string; priority: number } | null = null;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (!trimmedLine) continue;
    
    // Look for numbered or bulleted items
    const numberedMatch = trimmedLine.match(/^(\d+)[\.\)]\s*(.+)$/);
    const bulletMatch = trimmedLine.match(/^[-*•]\s*(.+)$/);
    
    if (numberedMatch || bulletMatch) {
      // Save previous subtask if exists
      if (currentSubtask) {
        subtasks.push(currentSubtask);
      }
      
      // Start new subtask
      const title = (numberedMatch?.[2] || bulletMatch?.[1] || '').trim();
      if (title) {
        currentSubtask = {
          title: title,
          description: '',
          priority: 1
        };
      }
    } else if (currentSubtask && trimmedLine) {
      // Add to description of current subtask
      currentSubtask.description += (currentSubtask.description ? ' ' : '') + trimmedLine;
    }
  }
  
  // Add the last subtask
  if (currentSubtask) {
    subtasks.push(currentSubtask);
  }
  
  // If no structured subtasks found, try to extract from general text
  if (subtasks.length === 0) {
    const sentences = aiResponse.split(/[.!?]+/).filter(s => s.trim().length > 10);
    subtasks.push(...sentences.slice(0, 5).map(sentence => ({
      title: sentence.trim().substring(0, 50) + (sentence.length > 50 ? '...' : ''),
      description: sentence.trim(),
      priority: 1
    })));
  }
  
  return subtasks;
}

// Helper: detect confirmation
function isConfirmation(message: string) {
  const yesWords = ['yes', 'sure', 'ok', 'okay', 'please', 'yep', 'yeah', 'do it', 'go ahead', 'break it down', 'confirm'];
  return yesWords.some(word => message.toLowerCase().includes(word));
}

// Track last created task in component state
let lastCreatedTask: { id: string, title: string, description?: string } | null = null;

// Helper: detect overwhelmed intent
function isOverwhelmedIntent(message: string) {
  const keywords = [
    'overwhelmed', 'too much', 'can\'t handle', 'stressed', 'so many tasks', 'too many tasks',
    'lost', 'don\'t know where to start', 'anxious', 'panic', 'burnt out', 'burned out', 'exhausted',
    'help me focus', 'help me prioritize', 'help me organize', 'help me break down', 'need help',
    'need to focus', 'need to organize', 'need to prioritize', 'need to break down'
  ];
  return keywords.some(word => message.toLowerCase().includes(word));
}

// Helper: detect 'show my tasks' intent
function isShowTasksIntent(message: string) {
  const keywords = [
    'show my tasks', 'list my tasks', 'what are my tasks', 'display my tasks', 'see my tasks', 'show tasks', 'list tasks', 'see tasks', 'display tasks'
  ];
  return keywords.some(word => message.toLowerCase().includes(word));
}

// Helper: detect 'help me prioritize' intent
function isPrioritizeIntent(userMessage: string) {
  const keywords = [
    'help me prioritize', 'prioritize my tasks', 'prioritize tasks', 'prioritize subtasks', 'help prioritize', 'sort tasks', 'sort subtasks', 'order tasks', 'order subtasks', 'which task first', 'which subtask first'
  ];
  return keywords.some(word => userMessage.toLowerCase().includes(word));
}

// Text-based task extraction AI response fetcher
async function fetchAIResponseWithTaskExtraction(userMessage: string, history: { sender: string, text: string }[], userId: string, onTaskCreated?: () => void) {
  const startTime = Date.now();
  
  try {
    // Check cache first for instant responses
    const cachedResponse = getCachedResponse(userMessage);
    if (cachedResponse) {
      logPerformance('responseTime', Date.now() - startTime);
      return cachedResponse;
    }

    const messages = [
      { role: 'system', content: 'You are PRODY, a productivity assistant. When users ask you to create or update tasks, respond naturally and helpfully.' },
      ...history.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      })),
      { role: 'user', content: userMessage }
    ];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

    const apiResponse = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: API_CONFIG.model,
        messages,
        temperature: API_CONFIG.temperature,
        max_tokens: API_CONFIG.max_tokens,
        top_p: API_CONFIG.top_p,
        frequency_penalty: API_CONFIG.frequency_penalty,
        presence_penalty: API_CONFIG.presence_penalty
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error('DeepSeek API error:', apiResponse.status, errorText);
      logPerformance('apiError');
      const cachedResponse = { text: `Sorry, there was an error with the API (${apiResponse.status}): ${errorText}`, suggestions: [] };
      cacheResponse(userMessage, cachedResponse);
      logPerformance('responseTime', Date.now() - startTime);
      return cachedResponse;
    }
    
    const data = await apiResponse.json();
    console.log('DeepSeek API response:', JSON.stringify(data, null, 2));
    const choice = data.choices && data.choices[0];
    if (!choice) {
      const cachedResponse = { text: 'Sorry, I could not get a response from the AI.', suggestions: [] };
      cacheResponse(userMessage, cachedResponse);
      logPerformance('responseTime', Date.now() - startTime);
      return cachedResponse;
    }

    // Get AI response
    const aiResponse = choice.message?.content?.trim() || 'Sorry, I could not get a response from the AI.';

    // --- OVERWHELMED INTENT DETECTION ---
    if (isOverwhelmedIntent(userMessage)) {
      const response = {
        text: "I'm here to help! Would you like me to help you prioritize your tasks or break them down into smaller steps?",
        suggestions: ["Help me prioritize", "Break down my tasks", "Show my tasks"]
      };
      cacheResponse(userMessage, response);
      return response;
    }

    // --- UPDATE LOGIC ---
    if (isUpdateIntent(userMessage)) {
      const updateTitle = extractTaskTitleForUpdate(userMessage);
      let allTasks = await offlineTaskService.getTasks(userId);
      let taskToUpdate;
      if (updateTitle === 'CONTEXTUAL_REFERENCE' && lastBotTask) {
        // Use the last bot-created task
        taskToUpdate = allTasks.find(t => t.id === lastBotTask.id);
      } else if (updateTitle === 'CONTEXTUAL_REFERENCE') {
        // Fallback: most recent task
        if (allTasks.length > 0) {
          allTasks = allTasks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          taskToUpdate = allTasks[0];
        }
      } else {
        taskToUpdate = allTasks.find(t => t.title.toLowerCase() === updateTitle?.toLowerCase());
      }
      
      if (taskToUpdate) {
        // Extract new details
        const updateInfo = extractTaskFromResponse(userMessage, aiResponse);
        const updates: any = {};
        if (updateInfo?.deadline) updates.deadline = updateInfo.deadline;
        if (updateInfo?.starttime) updates.starttime = updateInfo.starttime;
        if (updateInfo?.endtime) updates.endtime = updateInfo.endtime;
        if (updateInfo?.priority !== undefined) updates.priority = updateInfo.priority as import('../../types/task').TaskPriority;
        if (updateInfo?.description) updates.description = updateInfo.description;
        if (Object.keys(updates).length > 0) {
          await offlineTaskService.updateTask(taskToUpdate.id, updates);
          if (onTaskCreated) setTimeout(onTaskCreated, 100);
          return { text: `✅ Task "${taskToUpdate.title}" updated!`, suggestions: ["Break into subtasks", "Set a deadline", "Add to focus session"] };
        } else {
          return { text: `No update fields detected for task "${taskToUpdate.title}".`, suggestions: [] };
        }
      } else {
        if (updateTitle === 'CONTEXTUAL_REFERENCE') {
          return { text: `Could not find any recent tasks to update.`, suggestions: [] };
        } else {
          return { text: `Could not find a task titled "${updateTitle}" to update.`, suggestions: [] };
        }
      }
    }
    // --- END UPDATE LOGIC ---

    // --- SUBTASK CREATION LOGIC ---
    if (isSubtaskIntent(userMessage)) {
      try {
        // Extract parent task title from user message
        let parentTaskTitle = '';
        
        // Look for patterns like "subtask for X" or "break down X"
        const titlePatterns = [
          /(?:subtask|break down|divide|split|decompose)\s+(?:for\s+)?["']?([^"']+)["']?/i,
          /(?:subtask|break down|divide|split|decompose)\s+(?:called\s+)?["']?([^"']+)["']?/i
        ];
        
        for (const pattern of titlePatterns) {
          const match = userMessage.match(pattern);
          if (match && match[1]) {
            parentTaskTitle = match[1].trim();
            break;
          }
        }
        
        // If no explicit title found, try to extract from the message
        if (!parentTaskTitle) {
          // Remove subtask keywords and clean up the message
          const cleanMessage = userMessage
            .replace(/\b(subtask|break down|divide|split|decompose|create|make|add)\b/gi, '')
            .replace(/\b(for|called|named)\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
          
          if (cleanMessage) {
            parentTaskTitle = cleanMessage;
          }
        }
        
        if (parentTaskTitle) {
          const allTasks = await offlineTaskService.getTasks(userId);
          const parentTask = allTasks.find(t => 
            t.title.toLowerCase().includes(parentTaskTitle.toLowerCase()) ||
            parentTaskTitle.toLowerCase().includes(t.title.toLowerCase())
          );
          
          if (parentTask) {
            // Generate subtasks using AI
            const subtasks = await generateSubtasksWithAI(parentTask.title, parentTask.description || '', userId);
            
            const createdSubtasks = [];
            for (const subtask of subtasks) {
              const created = await offlineTaskService.createTask({
                title: subtask.title,
                description: subtask.description,
                priority: subtask.priority as import('../../types/task').TaskPriority,
                parent_task_id: parentTask.id
              }, userId);
              createdSubtasks.push(created);
            }
            
            if (onTaskCreated) setTimeout(onTaskCreated, 100);
            
            const subtaskList = createdSubtasks.map(s => `• ${s.title}`).join('\n');
            const response = { text: `✅ Created ${createdSubtasks.length} AI-generated subtasks for "${parentTask.title}":\n\n${subtaskList}\n\n${aiResponse}`, suggestions: ["Break into subtasks", "Set a deadline", "Add to focus session"] };
            cacheResponse(userMessage, response);
            return response;
          } else {
            const response = { text: `❌ Could not find a task titled "${parentTaskTitle}". Please make sure the task exists first.`, suggestions: [] };
            cacheResponse(userMessage, response);
            return response;
          }
        } else {
          const response = { text: `❌ Please specify which task you'd like me to create subtasks for. For example: "Create subtasks for my project" or "Break down my homework".`, suggestions: [] };
          cacheResponse(userMessage, response);
          return response;
        }
      } catch (e) {
        console.error('Subtask creation error:', e);
        const response = { text: `${aiResponse}\n\n❌ I couldn't create the subtasks automatically. Please try again.`, suggestions: [] };
        cacheResponse(userMessage, response);
        return response;
      }
    }
    // --- END SUBTASK CREATION LOGIC ---

    // If user confirms after a task was just created, break it down
    if (lastCreatedTask && isConfirmation(userMessage)) {
      // Generate subtasks for the last created task
      const subtasks = await generateSubtasksWithAI(lastCreatedTask.title, lastCreatedTask.description || '', userId);
      const createdSubtasks = [];
      for (const subtask of subtasks) {
        const created = await offlineTaskService.createTask({
          title: subtask.title,
          description: subtask.description,
          priority: subtask.priority as import('../../types/task').TaskPriority,
          parent_task_id: lastCreatedTask.id
        }, userId);
        createdSubtasks.push(created);
      }
      lastCreatedTask = null;
      const subtaskList = createdSubtasks.map(s => `• ${s.title}`).join('\n');
      const response = { text: `✅ Here are some subtasks for your task:\n${subtaskList}`, suggestions: ["Break into subtasks", "Set a deadline", "Add to focus session"] };
      cacheResponse(userMessage, response);
      return response;
    }

    // --- SHOW MY TASKS INTENT ---
    if (isShowTasksIntent(userMessage)) {
      const allTasks = await offlineTaskService.getTasks(userId);
      if (!allTasks || allTasks.length === 0) {
        const response = { text: "You have no tasks right now!", suggestions: ["Create a task"] };
        cacheResponse(userMessage, response);
        return response;
      }
      // Group subtasks by parent
      const parentTasks = allTasks.filter(t => !t.parent_task_id);
      const subtaskCounts: Record<string, number> = {};
      allTasks.forEach(t => {
        if (t.parent_task_id) {
          subtaskCounts[t.parent_task_id] = (subtaskCounts[t.parent_task_id] || 0) + 1;
        }
      });
      const lines = parentTasks.map(t => `• ${t.title} (${subtaskCounts[t.id] || 0} subtasks)`);
      const response = {
        text: `Here are your tasks:\n${lines.join("\n")}`,
        suggestions: ["Help me prioritize", "Break into subtasks", "Set a deadline"]
      };
      cacheResponse(userMessage, response);
      return response;
    }

    // --- PRIORITIZE INTENT ---
    if (isPrioritizeIntent(userMessage)) {
      const allTasks = await offlineTaskService.getTasks(userId);
      if (!allTasks || allTasks.length === 0) {
        const response = { text: "You have no tasks to prioritize!", suggestions: ["Create a task"] };
        cacheResponse(userMessage, response);
        return response;
      }
      // Get parent tasks (not subtasks)
      const parentTasks = allTasks.filter(t => !t.parent_task_id);
      // Numbered list for display
      const lines = parentTasks.map((t, i) => `${i + 1}. ${t.title} (${allTasks.filter(st => st.parent_task_id === t.id).length} subtasks)`);
      // Quick replies for each task and all tasks
      const suggestions = [
        "Prioritize all tasks",
        ...parentTasks.map((t, i) => `Prioritize task ${i + 1}`)
      ];
      // Parse if user selected a specific task
      const match = userMessage.match(/prioritize task (\d+)/i);
      if (match) {
        const idx = parseInt(match[1], 10) - 1;
        if (idx >= 0 && idx < parentTasks.length) {
          const selectedTask = parentTasks[idx];
          const subtasks = allTasks.filter(t => t.parent_task_id === selectedTask.id);
          if (subtasks.length === 0) {
            const response = {
              text: `Task '${selectedTask.title}' has no subtasks to prioritize.`,
              suggestions: ["Break into subtasks", "Show my tasks"]
            };
            cacheResponse(userMessage, response);
            return response;
          }
          // Numbered list of subtasks
          const subLines = subtasks
            .slice()
            .sort((a, b) => (b.priority || 0) - (a.priority || 0))
            .map((t, i) => `${i + 1}. ${t.title} (Priority: ${['Low','Medium','High','Urgent'][t.priority||0]})`);
          const response = {
            text: `Here are the prioritized subtasks for '${selectedTask.title}':\n${subLines.join("\n")}`,
            suggestions: ["Show my tasks"]
          };
          cacheResponse(userMessage, response);
          return response;
        } else {
          const response = {
            text: `Invalid task number. Please choose a valid task to prioritize.\n\nHere are your tasks:\n${lines.join("\n")}`,
            suggestions
          };
          cacheResponse(userMessage, response);
          return response;
        }
      }
      // Prioritize all tasks
      if (
        userMessage.toLowerCase().includes('prioritize all tasks') ||
        userMessage.toLowerCase().includes('prioritize my tasks') ||
        userMessage.toLowerCase().includes('prioritize tasks')
      ) {
        const sorted = parentTasks.slice().sort((a, b) => (b.priority || 0) - (a.priority || 0));
        const sortedLines = sorted.map((t, i) => `${i + 1}. ${t.title} (Priority: ${['Low','Medium','High','Urgent'][t.priority||0]})`);
        const response = {
          text: `Here are your prioritized tasks:\n${sortedLines.join("\n")}`,
          suggestions: ["Show my tasks"]
        };
        cacheResponse(userMessage, response);
        return response;
      }
      // Default: show numbered list and ask for selection
      const response = {
        text: `Here are your tasks:\n${lines.join("\n")}\n\nWhich task would you like to prioritize, or would you like to prioritize all tasks?`,
        suggestions
      };
      cacheResponse(userMessage, response);
      return response;
    }

    // Try to extract task information from the response
    const taskInfo = extractTaskFromResponse(userMessage, aiResponse);
    
    // If no task was extracted but user made an actionable request, create a basic task
    if (!taskInfo) {
      const actionableKeywords = ['tidy', 'clean', 'organize', 'study', 'read', 'write', 'work on', 'finish', 'buy', 'purchase', 'get', 'call', 'text', 'email', 'message', 'meet', 'go to', 'visit', 'attend'];
      const isActionable = actionableKeywords.some(keyword => userMessage.toLowerCase().includes(keyword));
      if (isActionable) {
        // Ask for clarification if the message is too vague
        if (userMessage.trim().split(' ').length < 4) {
          const response = { text: "Could you provide more details about the task? For example, what is the title, description, or deadline?", suggestions: [] };
          cacheResponse(userMessage, response);
          return response;
        }
        console.log('Creating fallback task for actionable request:', userMessage);
        try {
          const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
          const created = await offlineTaskService.createTask({ 
            title: userMessage.trim(), 
            description: aiResponse.trim(),
            deadline: today, // Add today as default deadline
          }, userId);
          console.log('Fallback task created successfully:', created);
          
          // Trigger a refresh by navigating to refresh the other screens
          setTimeout(() => {
            if (onTaskCreated) {
              console.log('Triggering refresh callback for fallback task');
              onTaskCreated();
            }
          }, 100);
          
          const response = { text: `✅ I've created a task for you: "${created.title}"\n\n${aiResponse}`, suggestions: ["Break into subtasks", "Set a deadline", "Add to focus session"] };
          cacheResponse(userMessage, response);
          return response;
        } catch (e) {
          console.error('Fallback task creation error:', e);
          const response = { text: 'Sorry, there was an error creating the task. Please try again later.', suggestions: [] };
          cacheResponse(userMessage, response);
          return response;
        }
      } else {
        // If not actionable, ask for clarification
        const response = { text: "Could you clarify what you want to do? For example, do you want to create a task, update one, or something else?", suggestions: [] };
        cacheResponse(userMessage, response);
        return response;
      }
    }
    
    if (taskInfo) {
      try {
        console.log('Creating task with info:', taskInfo);
        const created = await offlineTaskService.createTask({ 
          title: taskInfo.title, 
          description: taskInfo.description,
          ...(taskInfo.deadline ? { deadline: taskInfo.deadline } : {}),
          ...(taskInfo.starttime ? { starttime: taskInfo.starttime } : {}),
          ...(taskInfo.endtime ? { endtime: taskInfo.endtime } : {}),
          ...(taskInfo.priority !== undefined ? { priority: taskInfo.priority as import('../../types/task').TaskPriority } : {}),
        }, userId);
        console.log('Task created successfully:', created);
        
        // Store the last bot-created task
        lastBotTask = { id: created.id, title: created.title };
        lastCreatedTask = { id: created.id, title: created.title, description: created.description };
        
        // Trigger a refresh by navigating to refresh the other screens
        setTimeout(() => {
          if (onTaskCreated) {
            console.log('Triggering refresh callback');
            onTaskCreated();
          }
        }, 100);
        
        const response = { text: `✅ Task created successfully: "${created.title}".\nWould you like me to break this task down into subtasks?`, suggestions: ["Break into subtasks", "Set a deadline", "Add to focus session"] };
        cacheResponse(userMessage, response);
        return response;
      } catch (e) {
        console.error('Task creation error:', e);
        const response = { text: `${aiResponse}\n\n❌ I couldn't create the task automatically. Please try again.`, suggestions: [] };
        cacheResponse(userMessage, response);
        return response;
      }
    }
    
    const response = { text: aiResponse, suggestions: [] };
    cacheResponse(userMessage, response);
    logPerformance('responseTime', Date.now() - startTime);
    return response;
  } catch (err) {
    console.error('API call error:', err);
    logPerformance('apiError');
    const response = { text: 'Sorry, there was an error connecting to the AI.', suggestions: [] };
    cacheResponse(userMessage, response);
    logPerformance('responseTime', Date.now() - startTime);
    return response;
  }
}

// Utility to strip basic markdown formatting for bot messages
function stripMarkdown(text: string): string {
  // Remove code blocks
  text = text.replace(/```[\s\S]*?```/g, '');
  // Remove inline code
  text = text.replace(/`([^`]+)`/g, '$1');
  // Remove bold/italic/underline
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/_([^_]+)_/g, '$1');
  // Remove headings
  text = text.replace(/^#+\s?/gm, '');
  // Remove links but keep text
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
  // Remove images
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '');
  // Remove unordered/ordered list markers
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+\.\s+/gm, '');
  // Remove blockquotes
  text = text.replace(/^>\s?/gm, '');
  // Remove horizontal rules
  text = text.replace(/^---$/gm, '');
  return text.trim();
}

// Animated Typing Indicator (three bouncing dots)
const TypingIndicator = () => {
  const dot1 = React.useRef(new Animated.Value(0)).current;
  const dot2 = React.useRef(new Animated.Value(0)).current;
  const dot3 = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const createAnimation = (dot, delay) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(dot, { toValue: -6, duration: 300, delay, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true, easing: Easing.inOut(Easing.ease) })
        ])
      );
    };
    const a1 = createAnimation(dot1, 0);
    const a2 = createAnimation(dot2, 150);
    const a3 = createAnimation(dot3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [dot1, dot2, dot3]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginLeft: 8 }}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={i}
          style={{
            width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#7B61FF', marginHorizontal: 2,
            transform: [{ translateY: dot }],
          }}
        />
      ))}
    </View>
  );
};

// Simple cache for common responses to avoid API calls
const RESPONSE_CACHE = new Map<string, { text: string; suggestions: string[]; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Common response patterns that can be cached
const COMMON_PATTERNS = [
  { pattern: /\b(hi|hello|hey)\b/i, response: "Hello! How can I help you today?", suggestions: ["Create a task", "Show my tasks", "Help me prioritize"] },
  { pattern: /\b(thanks|thank you)\b/i, response: "You're welcome! Is there anything else I can help you with?", suggestions: ["Create a task", "Show my tasks"] },
  { pattern: /\b(bye|goodbye)\b/i, response: "Goodbye! Have a productive day!", suggestions: [] },
  { pattern: /\b(help|what can you do)\b/i, response: "I can help you:\n• Create and manage tasks\n• Break down complex tasks into subtasks\n• Prioritize your workload\n• Schedule your time\n\nJust tell me what you need!", suggestions: ["Create a task", "Show my tasks", "Help me prioritize"] }
];

// Check cache for common responses
function getCachedResponse(userMessage: string): { text: string; suggestions: string[] } | null {
  const now = Date.now();
  
  // Check for common patterns first
  for (const { pattern, response, suggestions } of COMMON_PATTERNS) {
    if (pattern.test(userMessage)) {
      logPerformance('cacheHit');
      return { text: response, suggestions };
    }
  }
  
  // Check cache
  const cacheKey = userMessage.toLowerCase().trim();
  const cached = RESPONSE_CACHE.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    logPerformance('cacheHit');
    return { text: cached.text, suggestions: cached.suggestions };
  }
  
  logPerformance('cacheMiss');
  return null;
}

// Cache a response
function cacheResponse(userMessage: string, response: { text: string; suggestions: string[] }) {
  const cacheKey = userMessage.toLowerCase().trim();
  RESPONSE_CACHE.set(cacheKey, { ...response, timestamp: Date.now() });
  
  // Clean up old cache entries
  if (RESPONSE_CACHE.size > 100) {
    const now = Date.now();
    for (const [key, value] of RESPONSE_CACHE.entries()) {
      if (now - value.timestamp > CACHE_DURATION) {
        RESPONSE_CACHE.delete(key);
      }
    }
  }
}

// Performance monitoring
const PERFORMANCE_METRICS = {
  responseTimes: [] as number[],
  cacheHits: 0,
  cacheMisses: 0,
  apiErrors: 0
};

function logPerformance(metric: 'responseTime' | 'cacheHit' | 'cacheMiss' | 'apiError', value?: number) {
  switch (metric) {
    case 'responseTime':
      if (value) {
        PERFORMANCE_METRICS.responseTimes.push(value);
        // Keep only last 50 measurements
        if (PERFORMANCE_METRICS.responseTimes.length > 50) {
          PERFORMANCE_METRICS.responseTimes.shift();
        }
        console.log(`Response time: ${value}ms (Avg: ${getAverageResponseTime()}ms)`);
      }
      break;
    case 'cacheHit':
      PERFORMANCE_METRICS.cacheHits++;
      console.log(`Cache hit! Total hits: ${PERFORMANCE_METRICS.cacheHits}`);
      break;
    case 'cacheMiss':
      PERFORMANCE_METRICS.cacheMisses++;
      console.log(`Cache miss. Total misses: ${PERFORMANCE_METRICS.cacheMisses}`);
      break;
    case 'apiError':
      PERFORMANCE_METRICS.apiErrors++;
      console.log(`API error. Total errors: ${PERFORMANCE_METRICS.apiErrors}`);
      break;
  }
}

function getAverageResponseTime(): number {
  if (PERFORMANCE_METRICS.responseTimes.length === 0) return 0;
  const sum = PERFORMANCE_METRICS.responseTimes.reduce((a, b) => a + b, 0);
  return Math.round(sum / PERFORMANCE_METRICS.responseTimes.length);
}

export default function ChatScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const speechRef = useRef<{ id: string | null }>({ id: null });
  // For quick reply button debounce
  const quickReplyLock = useRef(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Get username for personalized greeting
  const username = user?.user_metadata?.username || user?.email?.split('@')[0] || 'there';

  // Handle AI subtask requests from tasks screen
  useEffect(() => {
    if (params.aiSubtaskRequest && user) {
      const aiRequest = params.aiSubtaskRequest as string;
      setInput(aiRequest);
      // Auto-send the AI subtask request
      setTimeout(() => {
        handleSendAIRequest(aiRequest);
      }, 500);
    }
  }, [params.aiSubtaskRequest, user]);

  // Scroll to bottom on new message
  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  // Stop speech when unmounting or when a new message is played
  React.useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  // Track keyboard visibility to adjust input/nav positioning
  React.useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handlePlayPause = (id: string, text: string) => {
    if (speakingId === id) {
      Speech.stop();
      setSpeakingId(null);
      speechRef.current.id = null;
    } else {
      Speech.stop(); // Stop any previous speech
      setSpeakingId(id);
      speechRef.current.id = id;
      Speech.speak(text, {
        onDone: () => {
          if (speechRef.current.id === id) setSpeakingId(null);
        },
        onStopped: () => {
          if (speechRef.current.id === id) setSpeakingId(null);
        },
        onError: () => {
          if (speechRef.current.id === id) setSpeakingId(null);
        },
      });
    }
  };

  const handleSendAIRequest = async (aiRequest: string) => {
    if (!user) return;
    setInput('');
    setMessages(prev => [
      ...prev,
      { id: String(prev.length + 1), sender: 'user', text: aiRequest },
      { id: String(prev.length + 2), sender: 'bot', text: 'Prody is thinking...', loading: true },
    ]);
    
    const aiReplyRaw = await fetchAIResponseWithTaskExtraction(aiRequest, [
      ...messages,
      { sender: 'user', text: aiRequest }
    ], user.id, () => {
      router.setParams({ refresh: Date.now().toString() });
    });
    
    const aiReply = typeof aiReplyRaw === 'string' ? { text: aiReplyRaw, suggestions: [] } : aiReplyRaw;
    setMessages(prev => prev.map(m =>
      m.loading ? { ...m, text: aiReply.text, loading: false, suggestions: aiReply.suggestions } : m
    ));
  };

  const handleSend = async () => {
    if (!input.trim() || !user) return;
    const userMsg = input.trim();
    setInput('');
    
    // Check cache first for instant response
    const cachedResponse = getCachedResponse(userMsg);
    if (cachedResponse) {
      setMessages(prev => [
        ...prev,
        { id: String(prev.length + 1), sender: 'user', text: userMsg },
        { id: String(prev.length + 2), sender: 'bot', text: cachedResponse.text, loading: false, suggestions: cachedResponse.suggestions },
      ]);
      return;
    }
    
    setMessages(prev => [
      ...prev,
      { id: String(prev.length + 1), sender: 'user', text: userMsg },
      { id: String(prev.length + 2), sender: 'bot', text: 'Prody is thinking...', loading: true },
    ]);
    
    // Call DeepSeek with text-based task extraction
    const aiReplyRaw = await fetchAIResponseWithTaskExtraction(userMsg, [
      ...messages,
      { sender: 'user', text: userMsg }
    ], user.id, () => {
      // Trigger refresh by navigating to refresh other screens
      router.setParams({ refresh: Date.now().toString() });
    });
    const aiReply = typeof aiReplyRaw === 'string' ? { text: aiReplyRaw, suggestions: [] } : aiReplyRaw;
    setMessages(prev => prev.map(m =>
      m.loading ? { ...m, text: aiReply.text, loading: false, suggestions: aiReply.suggestions } : m
    ));
  };

  // Handle quick reply button click
  const handleQuickReply = async (suggestion: string) => {
    if (quickReplyLock.current) return;
    quickReplyLock.current = true;
    setMessages(prev => [
      ...prev,
      { id: String(prev.length + 1), sender: 'user', text: suggestion },
      { id: String(prev.length + 2), sender: 'bot', text: 'Prody is thinking...', loading: true },
    ]);
    setInput('');
    const aiReplyRaw = await fetchAIResponseWithTaskExtraction(suggestion, [
      ...messages,
      { sender: 'user', text: suggestion }
    ], user.id, () => {
      router.setParams({ refresh: Date.now().toString() });
    });
    const aiReply = typeof aiReplyRaw === 'string' ? { text: aiReplyRaw, suggestions: [] } : aiReplyRaw;
    setMessages(prev => prev.map(m =>
      m.loading ? { ...m, text: aiReply.text, loading: false, suggestions: aiReply.suggestions } : m
    ));
    setTimeout(() => { quickReplyLock.current = false; }, 500);
  };

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isBot = item.sender === 'bot';
    const displayText = isBot ? stripMarkdown(item.text) : item.text;
    return (
      <View style={[styles.messageRow, isBot ? styles.botRow : styles.userRow]}>
        {isBot && (
          <Avatar.Image source={botImage} size={40} style={styles.avatar} />
        )}
        <View style={[styles.bubble, isBot ? styles.botBubble : styles.userBubble]}>
          {item.loading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.messageText, styles.botText, { marginRight: 8 }]}>Prody is thinking</Text>
              <TypingIndicator />
            </View>
          ) : (
            <Text style={[styles.messageText, isBot ? styles.botText : styles.userText]}>{displayText}</Text>
          )}
        </View>
        {isBot && !item.loading && (
          <IconButton
            icon={speakingId === item.id ? 'pause' : 'play'}
            size={24}
            onPress={() => handlePlayPause(item.id, displayText)}
            style={{ marginLeft: 0 }}
            accessibilityLabel={speakingId === item.id ? 'Pause reading aloud' : 'Play message aloud'}
          />
        )}
        {!isBot && (
          <Avatar.Icon icon="account" size={40} style={styles.avatar} />
        )}
        {/* Quick reply buttons for suggestions */}
        {isBot && item.suggestions && item.suggestions.length > 0 && !item.loading && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
            {item.suggestions.map((suggestion, idx) => (
              <Button
                key={idx}
                mode="outlined"
                style={{ marginRight: 6, marginBottom: 4, borderRadius: 16 }}
                onPress={() => handleQuickReply(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={BOTTOM_NAV_TOTAL_HEIGHT}
      >
        <View style={[styles.container, { flex: 1 }]}> 
          {/* Header */}
          <View style={styles.header}>
            <Avatar.Image source={botImage} size={48} style={styles.headerAvatar} />
            <Text style={styles.headerTitle}>{BOT_NAME}</Text>
            <IconButton icon="arrow-left" onPress={() => router.back()} style={styles.headerBack} />
          </View>
          {/* Chat messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.messagesContainer}
            showsVerticalScrollIndicator={false}
          />
          {/* Input */}
          <View style={styles.inputRow}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Type your message..."
              style={styles.input}
              mode="outlined"
            />
            <IconButton
              icon="send"
              onPress={handleSend}
              style={styles.sendButton}
              disabled={!input.trim()}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
      {!keyboardVisible && (
        <View style={styles.bottomNavBarWrapper} pointerEvents="box-none">
          <BottomNavBar />
        </View>
      )}
      <OfflineIndicator />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    zIndex: 10,
  },
  headerAvatar: {
    marginRight: 12,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#7B61FF',
    flex: 1,
  },
  headerBack: {
    position: 'absolute',
    left: 0,
    top: 44,
    backgroundColor: 'transparent',
  },
  messagesContainer: {
    padding: 16,
    paddingBottom: BOTTOM_NAV_TOTAL_HEIGHT + INPUT_BAR_HEIGHT + 24, // Default space when keyboard hidden
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  botRow: {
    justifyContent: 'flex-start',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  avatar: {
    backgroundColor: '#fff',
    marginRight: 8,
    marginLeft: 8,
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  botBubble: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 0,
    borderColor: '#EEE',
    borderWidth: 1,
  },
  userBubble: {
    backgroundColor: '#7B61FF',
    borderTopRightRadius: 0,
  },
  messageText: {
    fontSize: 16,
  },
  botText: {
    color: '#222',
  },
  userText: {
    color: '#fff',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: BOTTOM_NAV_TOTAL_HEIGHT,
    zIndex: 1100,
  },
  input: {
    flex: 1,
    marginRight: 8,
    backgroundColor: '#F7F8FA',
  },
  sendButton: {
    backgroundColor: '#7B61FF',
  },
  bottomNavBarWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000, // Ensure it's above all content
  },
}); 