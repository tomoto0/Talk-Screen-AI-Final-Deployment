import json
import requests
import time
from flask import Blueprint, request, jsonify, session
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

gemini_improved_bp = Blueprint('gemini_improved', __name__)

# Hardcoded API key as requested
# GEMINI_API_KEY = 'AIzaSyD_fAtMwNhjLEy-8zsJFq-tagWIZYNgmVU'
# Manus LLM API is compatible with OpenAI SDK, using environment variable OPENAI_API_KEY
# and a custom base URL.
# The model to use is 'gemini-2.5-flash' which is available via the Manus LLM API.
# We will use the requests library to directly call the OpenAI-compatible endpoint.
# The base URL for the Manus LLM API is typically derived from the environment, 
# but for direct requests, we'll use the pre-configured environment variable OPENAI_API_BASE.
# Since we are using the requests library, we will construct the URL using the environment variable.
# We will use the pre-configured OPENAI_API_KEY from the environment.
import os
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
MANUS_LLM_API_BASE = "https://api.manus.im/v1" # Assuming a standard OpenAI-compatible endpoint
MANUS_LLM_API_URL = f"{MANUS_LLM_API_BASE}/chat/completions"
MANUS_LLM_MODEL = 'gemini-2.5-flash'
# GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

# In-memory conversation storage (in production, use a database)
conversations = {}

def get_session_id():
    """Get or create a session ID for conversation context"""
    if 'session_id' not in session:
        session['session_id'] = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
    return session['session_id']

def get_conversation_history(session_id):
    """Get conversation history for a session"""
    if session_id not in conversations:
        conversations[session_id] = []
    return conversations[session_id]

def add_to_conversation(session_id, role, content, image_data=None):
    """Add a message to conversation history"""
    if session_id not in conversations:
        conversations[session_id] = []
    
    message = {
        'role': role,
        'content': content,
        'timestamp': datetime.now().isoformat()
    }
    
    if image_data:
        message['has_image'] = True
    
    conversations[session_id].append(message)
    
    # Keep only last 20 messages to avoid memory issues
    if len(conversations[session_id]) > 20:
        conversations[session_id] = conversations[session_id][-20:]

def build_conversation_context(history, current_text, current_image):
    """Build conversation context for OpenAI-compatible API"""
    """Build conversation context for Gemini API"""
    contents = []
    
    # Add conversation history (last 10 messages for context)
    # Convert Gemini format to OpenAI format (role: user/model -> role: user/assistant)
    for message in history[-10:]:
        if message['role'] in ['user', 'model']:
            role = 'assistant' if message['role'] == 'model' else 'user'
            contents.append({
                'role': role,
                'content': message['content']
            })
    
    # Add current message
    # OpenAI-compatible APIs typically use a single 'content' string for text and a list of objects for multimodal.
    # We will adapt the structure to the expected OpenAI chat completions format.
    current_parts = []
    if current_text:
        current_parts.append({'type': 'text', 'text': current_text})
    
    if current_image:
        current_parts.append({
            'type': 'image_url',
            'image_url': {
                'url': f"data:image/jpeg;base64,{current_image}"
            }
        })
    
    if current_parts:
        contents.append({
            'role': 'user',
            'content': current_parts
        })
    
    return contents

def call_manus_llm_api_with_retry(contents, max_retries=3, base_delay=1):
    """Call Manus LLM API (OpenAI-compatible) with retry mechanism"""
    """Call Gemini API with retry mechanism for handling 503 errors"""
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {OPENAI_API_KEY}'
    }
    
    data = {
        'model': MANUS_LLM_MODEL,
        'messages': contents,
        'temperature': 0.7,
        'max_tokens': 2048,
        'top_p': 0.95,
        # Safety settings are typically handled by the service provider in OpenAI-compatible APIs
    }
    
    for attempt in range(max_retries):
        try:
            logger.info(f"Sending request to Manus LLM API (attempt {attempt + 1}/{max_retries})")
            
            response = requests.post(
                MANUS_LLM_API_URL,
                headers=headers,
                json=data,
                timeout=60  # Increased timeout to 60 seconds
            )
            
            logger.info(f"Manus LLM API response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                
                if 'choices' in result and len(result['choices']) > 0:
                    choice = result['choices'][0]
                    if 'message' in choice and 'content' in choice['message']:
                        response_text = choice['message']['content']
                        return response_text
                    else:
                        logger.error(f"Unexpected response structure: {result}")
                        return "Error: Unexpected response format from AI."
                else:
                    logger.error(f"No choices in response: {result}")
                    return "Error: No response generated by AI."
            
            elif response.status_code == 503:
                # Service Unavailable - retry with exponential backoff
                if attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt)  # Exponential backoff
                    logger.warning(f"503 Service Unavailable. Retrying in {delay} seconds...")
                    time.sleep(delay)
                    continue
                else:
                    logger.error("Max retries reached for 503 error")
                    return "Error: AI service is temporarily unavailable. Please try again in a few moments."
            
            elif response.status_code == 429:
                # Rate limit exceeded - retry with longer delay
                if attempt < max_retries - 1:
                    delay = base_delay * (3 ** attempt)  # Longer delay for rate limits
                    logger.warning(f"429 Rate limit exceeded. Retrying in {delay} seconds...")
                    time.sleep(delay)
                    continue
                else:
                    logger.error("Max retries reached for rate limit")
                    return "Error: Rate limit exceeded. Please try again later."
            
            elif response.status_code == 400:
                error_text = response.text
                logger.error(f"400 Bad Request: {error_text}")
                return "Error: Invalid request format. Please try again."
            
            else:
                error_text = response.text
                logger.error(f"Manus LLM API error: {response.status_code} - {error_text}")
                return f"Error: API returned {response.status_code}. Please try again."
                
        except requests.exceptions.Timeout:
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)
                logger.warning(f"Request timeout. Retrying in {delay} seconds...")
                time.sleep(delay)
                continue
            else:
                logger.error("Max retries reached for timeout")
                return "Error: Request timed out. Please try again."
        
        except requests.exceptions.ConnectionError:
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)
                logger.warning(f"Connection error. Retrying in {delay} seconds...")
                time.sleep(delay)
                continue
            else:
                logger.error("Max retries reached for connection error")
                return "Error: Connection failed. Please check your internet connection."
        
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error: {e}")
            return f"Error: Network error occurred."
        
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            return f"Error: An unexpected error occurred."
    
    return "Error: Failed to get response after multiple attempts."

@gemini_improved_bp.route('/chat-with-context', methods=['POST'])
def chat_with_context():
    """Chat with Gemini AI while maintaining conversation context"""
    try:
        data = request.get_json()
        text = data.get('text', '').strip()
        image_data = data.get('image')
        
        logger.info(f"Chat request - text: {bool(text)}, image: {bool(image_data)}")
        
        if not text and not image_data:
            return jsonify({'error': 'No text or image provided'}), 400
        
        session_id = get_session_id()
        conversation_history = get_conversation_history(session_id)
        
        # Build conversation context
        contents = build_conversation_context(conversation_history, text, image_data)
        
        if not contents:
            return jsonify({'error': 'No valid content to send'}), 400
        
        # Call Manus LLM API with retry mechanism
        response_text = call_manus_llm_api_with_retry(contents)
        
        # Add user message to conversation history
        user_content = text if text else "[Image shared]"
        add_to_conversation(session_id, 'user', user_content, image_data)
        
        # Add AI response to conversation history
        add_to_conversation(session_id, 'model', response_text)
        
        return jsonify({
            'success': True,
            'response': response_text,
            'session_id': session_id,
            'message_count': len(conversations[session_id])
        }), 200, {'Content-Type': 'application/json'}
        
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        return jsonify({'error': str(e)}), 500

@gemini_improved_bp.route('/clear-context', methods=['POST'])
def clear_context():
    """Clear conversation context for current session"""
    try:
        session_id = get_session_id()
        if session_id in conversations:
            conversations[session_id] = []
        
        return jsonify({
            'success': True,
            'message': 'Conversation context cleared'
        }), 200, {'Content-Type': 'application/json'}
        
    except Exception as e:
        logger.error(f"Error clearing context: {e}")
        return jsonify({'error': str(e)}), 500

@gemini_improved_bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy', 
        'service': 'gemini_improved',
        'active_sessions': len(conversations)
    })

@gemini_improved_bp.route('/session-info', methods=['GET'])
def session_info():
    """Get current session information"""
    try:
        session_id = get_session_id()
        conversation_history = get_conversation_history(session_id)
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'message_count': len(conversation_history),
            'last_activity': conversation_history[-1]['timestamp'] if conversation_history else None
        })
        
    except Exception as e:
        logger.error(f"Error getting session info: {e}")
        return jsonify({'error': str(e)}), 500

