import json
import requests
from flask import Blueprint, request, jsonify, session
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

translation_bp = Blueprint('translation', __name__)

# Hardcoded API key as requested
# GEMINI_API_KEY = 'AIzaSyD_fAtMwNhjLEy-8zsJFq-tagWIZYNgmVU'
# Manus LLM API is compatible with OpenAI SDK, using environment variable OPENAI_API_KEY
# and a custom base URL.
# We will use the requests library to directly call the OpenAI-compatible endpoint.
import os
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
MANUS_LLM_API_BASE = "https://api.manus.im/v1" # Assuming a standard OpenAI-compatible endpoint
MANUS_LLM_API_URL = f"{MANUS_LLM_API_BASE}/chat/completions"
MANUS_LLM_MODEL = 'gemini-2.5-flash'
# GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

# Supported languages
SUPPORTED_LANGUAGES = {
    'en': 'English',
    'ja': 'Japanese',
    'es': 'Spanish',
    'zh': 'Chinese',
    'fr': 'French',
    'it': 'Italian',
    'ko': 'Korean',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'ru': 'Russian',
    'id': 'Indonesian',
    'pt': 'Portuguese'
}

# In-memory translation storage (in production, use a database)
translation_history = {}

def get_session_id():
    """Get or create a session ID for translation context"""
    if 'session_id' not in session:
        session['session_id'] = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
    return session['session_id']

def get_translation_history(session_id):
    """Get translation history for a session"""
    if session_id not in translation_history:
        translation_history[session_id] = []
    return translation_history[session_id]

def add_to_translation_history(session_id, original_text, translated_text, target_language):
    """Add a translation to history"""
    if session_id not in translation_history:
        translation_history[session_id] = []
    
    translation_history[session_id].append({
        'original': original_text,
        'translated': translated_text,
        'language': target_language,
        'timestamp': datetime.now().isoformat()
    })
    
    # Keep only last 10 translations to avoid memory issues
    if len(translation_history[session_id]) > 10:
        translation_history[session_id] = translation_history[session_id][-10:]

def build_translation_prompt(text_to_translate, target_language, conversation_context):
    """Build a context-aware translation prompt for Manus LLM API"""
    """Build a context-aware translation prompt for Gemini API"""
    language_name = SUPPORTED_LANGUAGES.get(target_language, target_language)
    
    # Build context from recent conversation
    context_text = ""
    if conversation_context and len(conversation_context) > 0:
        context_text = "\n\nRecent conversation context for reference:\n"
        for i, msg in enumerate(conversation_context[-3:], 1):  # Last 3 messages
            role = "User" if msg.get('role') == 'user' else "AI Assistant"
            context_text += f"{i}. {role}: {msg.get('content', '')}\n"
    
    prompt = f"""You are a professional translator. Please translate the following text to {language_name}.

IMPORTANT INSTRUCTIONS:
1. Consider the conversation context provided below to ensure accurate and contextually appropriate translation
2. Maintain the tone and style of the original text
3. If the text contains technical terms or proper nouns, keep them appropriately
4. Provide ONLY the translated text without any explanations or additional comments
5. If the text is already in {language_name}, return it as-is

Text to translate: "{text_to_translate}"{context_text}

Translation:"""
    
    return prompt

def call_manus_llm_translation_api(prompt):
    """Call Manus LLM API for translation with proper error handling"""
    """Call Gemini API for translation with proper error handling"""
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {OPENAI_API_KEY}'
    }
    
    data = {
        'model': MANUS_LLM_MODEL,
        'messages': [
            {
                'role': 'user',
                'content': prompt
            }
        ],
        'temperature': 0.3,  # Lower temperature for more consistent translations
        'max_tokens': 1024,
        'top_p': 0.95,
        # Safety settings are typically handled by the service provider in OpenAI-compatible APIs
    }
    
    try:
        logger.info("Sending translation request to Manus LLM API")
        
        response = requests.post(
            MANUS_LLM_API_URL,
            headers=headers,
            json=data,
            timeout=30
        )
        
        logger.info(f"Manus LLM API translation response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            
            if 'choices' in result and len(result['choices']) > 0:
                choice = result['choices'][0]
                if 'message' in choice and 'content' in choice['message']:
                    translation = choice['message']['content'].strip()
                    return translation
                else:
                    logger.error(f"Unexpected translation response structure: {result}")
                    return "Translation error: Unexpected response format."
            else:
                logger.error(f"No choices in translation response: {result}")
                return "Translation error: No translation generated."
        else:
        error_text = response.text
        logger.error(f"Manus LLM API translation error: {response.status_code} - {error_text}")
        return f"Translation error: API returned {response.status_code}"
            
    except requests.exceptions.Timeout:
        logger.error("Manus LLM API translation request timed out")
        return "Translation error: Request timed out."
    except requests.exceptions.RequestException as e:
        logger.error(f"Translation request error: {e}")
        return f"Translation error: Network error"
    except Exception as e:
        logger.error(f"Unexpected error in translation: {e}")
        return f"Translation error: Unexpected error"

@translation_bp.route('/translate', methods=['POST'])
def translate_text():
    """Translate text with conversation context"""
    try:
        data = request.get_json()
        text_to_translate = data.get('text', '').strip()
        target_language = data.get('target_language', 'en')
        conversation_context = data.get('conversation_context', [])
        
        logger.info(f"Translation request - text: {bool(text_to_translate)}, target: {target_language}")
        
        if not text_to_translate:
            return jsonify({'error': 'No text provided for translation'}), 400
        
        if target_language not in SUPPORTED_LANGUAGES:
            return jsonify({'error': f'Unsupported language: {target_language}'}), 400
        
        session_id = get_session_id()
        
        # Build translation prompt with context
        prompt = build_translation_prompt(text_to_translate, target_language, conversation_context)
        
        # Call Manus LLM API for translation
        translated_text = call_manus_llm_translation_api(prompt)
        
        # Add to translation history
        add_to_translation_history(session_id, text_to_translate, translated_text, target_language)
        
        return jsonify({
            'success': True,
            'original_text': text_to_translate,
            'translated_text': translated_text,
            'target_language': target_language,
            'language_name': SUPPORTED_LANGUAGES[target_language],
            'session_id': session_id
        }), 200, {'Content-Type': 'application/json'}
        
    except Exception as e:
        logger.error(f"Error in translate endpoint: {e}")
        return jsonify({'error': str(e)}), 500

@translation_bp.route('/languages', methods=['GET'])
def get_supported_languages():
    """Get list of supported languages"""
    try:
        return jsonify({
            'success': True,
            'languages': SUPPORTED_LANGUAGES
        }), 200, {'Content-Type': 'application/json'}
        
    except Exception as e:
        logger.error(f"Error getting languages: {e}")
        return jsonify({'error': str(e)}), 500

@translation_bp.route('/history', methods=['GET'])
def get_translation_history():
    """Get translation history for current session"""
    try:
        session_id = get_session_id()
        history = get_translation_history(session_id)
        
        return jsonify({
            'success': True,
            'history': history,
            'session_id': session_id
        }), 200, {'Content-Type': 'application/json'}
        
    except Exception as e:
        logger.error(f"Error getting translation history: {e}")
        return jsonify({'error': str(e)}), 500

@translation_bp.route('/clear-history', methods=['POST'])
def clear_translation_history():
    """Clear translation history for current session"""
    try:
        session_id = get_session_id()
        if session_id in translation_history:
            translation_history[session_id] = []
        
        return jsonify({
            'success': True,
            'message': 'Translation history cleared'
        }), 200, {'Content-Type': 'application/json'}
        
    except Exception as e:
        logger.error(f"Error clearing translation history: {e}")
        return jsonify({'error': str(e)}), 500

@translation_bp.route('/health', methods=['GET'])
def translation_health_check():
    return jsonify({
        'status': 'healthy', 
        'service': 'translation',
        'supported_languages': len(SUPPORTED_LANGUAGES)
    }), 200, {'Content-Type': 'application/json'}

