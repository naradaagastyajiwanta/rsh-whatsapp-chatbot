# RSH WhatsApp AI Chatbot

An intelligent WhatsApp chatbot system with administrative dashboard, built with OpenAI Assistant API, Flask backend, and Next.js frontend.

## System Architecture

The system consists of three main components:

1. **Frontend** (Next.js): Administrative dashboard for monitoring conversations, managing bot status, and viewing analytics
2. **Backend** (Flask): REST API serving the frontend and managing OpenAI Assistant conversations
3. **WhatsApp Service** (Node.js): Integration with WhatsApp using Baileys, handling incoming and outgoing messages

### Database

The system uses Supabase PostgreSQL for data storage, migrated from the original SQLite implementation. The database stores:
- Chat history
- Bot status (enabled/disabled)
- OpenAI Assistant thread IDs
- Unanswered message counts
- Token usage analytics

## Setup Instructions

### Prerequisites

- Node.js (v14+)
- Python (v3.8+)
- PostgreSQL or Supabase account
- OpenAI API key
- AWS account (for deployment)

### Local Development

#### 1. Backend Setup

```bash
# Navigate to backend directory
cd rsh-ai-backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
# Create a .env file with:
# OPENAI_API_KEY=your_openai_api_key
# SUPABASE_DB_URL=your_supabase_connection_string

# Initialize database
python create_supabase_tables.py

# Run the application
python app.py
```

#### 2. WhatsApp Service Setup

```bash
# Navigate to WhatsApp service directory
cd whatsapp-service

# Install dependencies
npm install

# Set environment variables
# Create a .env file with:
# BACKEND_URL=http://localhost:5000
# WS_PORT=3001

# Run the application
npm start
```

#### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd chatbot-admin-dashboard

# Install dependencies
npm install

# Set environment variables
# Create a .env.local file with:
# NEXT_PUBLIC_API_URL=http://localhost:5000
# NEXT_PUBLIC_WS_URL=ws://localhost:3001

# Run the application
npm run dev
```

## Deployment Instructions

### AWS Deployment

The project includes a PowerShell script `aws-deploy.ps1` for automated deployment:

1. **Backend and WhatsApp Service**: Deployed to AWS Elastic Beanstalk
2. **Frontend**: Deployed to AWS Amplify

```powershell
# Run the deployment script
./aws-deploy.ps1
```

### Environment Variables

Make sure to set these environment variables in the AWS deployment:

- **Backend**:
  - `OPENAI_API_KEY`: Your OpenAI API key
  - `SUPABASE_DB_URL`: Your Supabase connection string

- **WhatsApp Service**:
  - `BACKEND_URL`: URL of your deployed backend
  - `WS_PORT`: WebSocket port

- **Frontend**:
  - `NEXT_PUBLIC_API_URL`: URL of your deployed backend
  - `NEXT_PUBLIC_WS_URL`: URL of your deployed WebSocket server

## Features

- **Real-time Updates**: WebSocket integration for live updates without page refreshes
- **Analytics Dashboard**: Track conversation metrics and token usage
- **Bot Management**: Enable/disable the bot for specific phone numbers
- **Conversation History**: View and search through past conversations
- **Token Usage Tracking**: Monitor OpenAI API usage for cost control

## Troubleshooting

### Database Connection Issues

If you experience database connection issues:

1. Use `check_env.py` to verify your environment configuration
2. Check that the `SUPABASE_DB_URL` is correctly formatted
3. Verify that the tables exist using `create_supabase_tables.py`

### Deployment Issues

For AWS Amplify deployment issues:

1. Check the build configuration in `amplify.yml`
2. For Next.js applications, ensure the output configuration in `next.config.js` is correctly set
3. Review AWS Amplify logs for detailed error messages

## Migration Notes

This project was migrated from SQLite to Supabase PostgreSQL. Reference `SUPABASE_MIGRATION.md` for detailed information about the migration process.
