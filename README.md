# Editia Server Primary 🎬

[![CI](https://github.com/your-org/editia/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/editia/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18.x%20%7C%2020.x-green.svg)](https://nodejs.org/)
[![Vitest](https://img.shields.io/badge/Tested%20with-Vitest-729B1A.svg)](https://vitest.dev/)

The primary backend server for Editia - an AI-powered video generation platform that transforms scripts into engaging videos with voice cloning, dynamic templates, and intelligent content optimization.

## 🚀 Features

### 🎯 Core Video Generation Pipeline
- **Script-to-Video Generation**: Transform text scripts into professional videos using Creatomate API
- **AI Voice Cloning**: Integrate with ElevenLabs for personalized voice synthesis
- **Dynamic Template System**: Intelligent scene planning and template generation
- **Watermark Management**: Automatic watermark injection for free-tier users
- **Advanced Validation**: 6-phase validation system ensuring high-quality output

### 🔧 AI-Powered Services
- **Script Enhancement**: AI chat assistance for script improvement
- **Content Optimization**: Gemini-powered script analysis and refinement
- **Voice Processing**: Advanced voice sample management and cloning
- **Template Intelligence**: Smart template selection and customization

### 🛡️ Enterprise-Ready Features
- **Clerk Authentication**: Secure user management and JWT validation
- **Usage Tracking**: Comprehensive usage analytics and plan enforcement
- **RLS Security**: Row-level security with Supabase integration
- **Error Handling**: Robust error recovery and logging with Winston
- **Testing Coverage**: 47/47 tests passing with Vitest framework

## 📋 Requirements

- **Node.js**: 18.x or 20.x
- **TypeScript**: 5.0+
- **Database**: Supabase (PostgreSQL)
- **Storage**: AWS S3
- **Authentication**: Clerk
- **Video API**: Creatomate
- **Voice API**: ElevenLabs

## 🏗️ Installation

```bash
# Clone the repository
git clone <repository-url>
cd server-primary

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Build the application
npm run build

# Start development server
npm run dev
```

## 🔧 Configuration

### Required Environment Variables

```bash
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Authentication
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key

# AWS S3
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=your_aws_region
AWS_S3_BUCKET=your_s3_bucket

# External APIs
CREATOMATE_API_KEY=your_creatomate_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key

# Logging (Optional)
LOGTAIL_SOURCE_TOKEN=your_logtail_token
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in UI mode
npm run test:ui

# Run specific test suites
npm run test:run -- video           # Video services only
npm run test:run -- watermark       # Watermark service only
npm run test:run -- validation      # Validation service only
```

### Test Coverage

- ✅ **47/47 tests passing** across all video services
- 🎯 **Comprehensive coverage** of critical video generation paths
- ⚡ **~355ms execution time** for full video test suite
- 🔧 **Dependency injection pattern** for easy mocking

## 📚 API Documentation

### 🎬 Video Generation Endpoints

#### Generate Video from Script
```http
POST /api/scripts/generate-video/:id
Authorization: Bearer <clerk_jwt_token>

# Generates a video from a script with AI voice cloning and dynamic templates
```

#### Video Status & Management
```http
GET /api/videos/status/:id      # Check video generation status
DELETE /api/videos/:id          # Delete generated video
```

### 📝 Script Management

```http
GET /api/scripts               # List user scripts
POST /api/scripts              # Create new script
DELETE /api/scripts/:id        # Delete script
POST /api/scripts/chat         # AI chat assistance
PUT /api/scripts/modify        # Modify script content
```

### 🎤 Voice Cloning

```http
POST /api/voice-clone          # Upload voice sample
GET /api/voice-clone/library   # List voice samples
DELETE /api/voice-clone/:id    # Delete voice sample
```

### 📹 Source Video Management

```http
POST /api/s3-upload            # Upload source videos
GET /api/source-videos         # List source videos
DELETE /api/source-videos/:id  # Delete source video
```

## 🏗️ Architecture

### 📁 Project Structure

```
server-primary/
├── src/
│   ├── services/video/           # Video generation pipeline
│   │   ├── generator.ts          # Main video generator
│   │   ├── template-service.ts   # Template generation
│   │   ├── validation-service.ts # 6-phase validation
│   │   ├── watermark-service.ts  # Watermark injection
│   │   └── __tests__/           # Comprehensive test suite
│   ├── routes/api/              # REST API endpoints
│   ├── middleware/              # Authentication & rate limiting
│   ├── config/                  # Service configurations
│   └── types/                   # TypeScript definitions
├── docs/                        # Documentation
├── .github/workflows/           # CI/CD pipelines
└── dist/                        # Production build
```

### 🔄 Video Generation Flow

```
1. Script Input → 2. AI Enhancement → 3. Voice Processing
        ↓
4. Template Generation → 5. Validation (6 phases) → 6. Creatomate Render
        ↓
7. Watermark Injection → 8. Final Output → 9. Storage & Delivery
```

### 🧪 Testing Architecture

- **Unit Tests**: Services and utilities with dependency injection
- **Integration Tests**: API endpoints and service interactions  
- **Fixtures**: Realistic test data from production scenarios
- **Mocking Strategy**: Dependency injection over complex module mocking

## 🚀 Deployment

### Railway Deployment

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template/Abo1zu?referralCode=alphasec)

### Manual Deployment

```bash
# Build for production
npm run build

# Start production server
npm start

# With PM2 (recommended)
pm2 start dist/app.js --name "editia-server"
```

### Environment Setup

1. **Database Setup**: Configure Supabase with required tables and RLS policies
2. **Storage Setup**: Configure AWS S3 bucket with proper CORS settings
3. **API Keys**: Set up accounts with Creatomate, ElevenLabs, OpenAI, and Gemini
4. **Authentication**: Configure Clerk with proper JWT settings

## 📊 Performance & Monitoring

### Key Metrics
- **Video Generation**: ~30-60 seconds average processing time
- **Test Suite**: <500ms execution time for all video services
- **API Response**: <200ms for most endpoints (excluding video generation)
- **Memory Usage**: ~100MB baseline, ~500MB during video processing

### Logging & Monitoring
- **Winston Logger**: Structured logging with multiple transports
- **Logtail Integration**: Cloud log aggregation and analysis
- **Error Tracking**: Comprehensive error handling and reporting
- **Performance Monitoring**: Request timing and resource usage tracking

## 🔒 Security

- **Authentication**: Clerk JWT token validation on all endpoints
- **Authorization**: Row-level security (RLS) with Supabase
- **Input Validation**: Zod schema validation for all API inputs
- **Rate Limiting**: Usage-based rate limiting and plan enforcement
- **Data Protection**: Secure handling of voice samples and personal data

## 🧩 Service Dependencies

### Core Services
- **WatermarkService**: Plan-based watermark injection `watermark-service.ts:25`
- **ValidationService**: 6-phase video validation `validation-service.ts:45`
- **VideoTemplateService**: AI-powered template generation `template-service.ts:67`
- **CreatomateBuilder**: Video rendering and API integration `creatomateBuilder.ts:34`

### External Integrations
- **Clerk**: User authentication and session management
- **Supabase**: Database, real-time subscriptions, and storage
- **Creatomate**: Video rendering and template processing
- **ElevenLabs**: Voice cloning and synthesis
- **OpenAI/Gemini**: AI text processing and enhancement

## 🤝 Contributing

### Development Workflow

1. **Setup**: Install dependencies and configure environment
2. **Testing**: Write tests using dependency injection pattern
3. **Development**: Follow existing code patterns and conventions
4. **Validation**: Run tests and type checking before commit
5. **Documentation**: Update relevant documentation

### Code Standards

- **TypeScript**: Strict mode with comprehensive type definitions
- **Testing**: Dependency injection for easy mocking
- **Logging**: Structured logging with appropriate levels
- **Error Handling**: Graceful degradation and user-friendly messages
- **Security**: Never log sensitive data or expose internal details

### Adding New Features

1. **Service Layer**: Create service with dependency injection
2. **API Layer**: Add route with proper authentication
3. **Testing**: Write comprehensive unit and integration tests
4. **Documentation**: Update API docs and architecture diagrams
5. **Validation**: Ensure all tests pass and types are correct

## 📖 Documentation

- [Testing Guide](docs/TESTING_GUIDE.md) - Comprehensive testing strategies and best practices
- [Video Pipeline](docs/SCRIPT_VIDEO_PIPELINE.md) - Deep dive into video generation flow
- [Railway Deployment](docs/railway-deployment.md) - Production deployment guide
- [Creatomate Integration](docs/creatomate.md) - Video API integration details

## 🆘 Troubleshooting

### Common Issues

**Video Generation Fails**
- Check Creatomate API key and quota
- Verify voice sample quality and format
- Review template validation errors in logs

**Authentication Errors**
- Verify Clerk JWT token configuration
- Check Supabase RLS policies
- Ensure proper CORS setup

**Test Failures**
- Use dependency injection instead of module mocking
- Check test fixture data matches current schema
- Verify mock setup in `beforeEach` blocks

### Support

For issues and feature requests, please:
1. Check existing documentation
2. Review test cases for expected behavior  
3. Check logs for detailed error information
4. Create an issue with reproduction steps

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built with ❤️ by the Editia Team**

Transform your ideas into engaging videos with the power of AI.