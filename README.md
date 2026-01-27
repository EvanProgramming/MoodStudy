# Mood Study

**Transform chaotic mood signals into actionable rhythms.**

Mood Study is a web-based academic planning application that helps students and self-learners optimize their study schedules by analyzing mood patterns, learning behaviors, and daily habits. The platform combines mood tracking, academic goal planning, and AI-powered insights to create personalized study roadmaps that adapt to your emotional patterns.

## Features

- **Mood Tracking**: Log daily mood ratings, emotional tags, and notes to identify patterns
- **Learning Analytics**: Track study hours, focus levels, and learning behaviors
- **Sleep & Habit Monitoring**: Monitor sleep patterns and daily routines
- **Academic Planning**: Set and track GPA goals, AP courses, and university targets
- **AI-Powered Insights**: Get personalized feedback and recommendations by LLM based on your data
- **Focus Mode**: Built-in Pomodoro timer for deep work sessions
- **GPA Simulator**: Simulate future course grades and academic scenarios
- **Visual Analytics**: Interactive charts and visualizations of your mood and habit patterns
- **Event Tracking**: Manage deadlines and academic milestones

## Live Website

🌐 **Visit the live application**: [https://moodstudy.app/](https://moodstudy.app/)

## Setup Instructions

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, or Edge)
- A Supabase account and project (for backend services)
- A Hugging Face API token (for AI features)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/MoodStudy.git
   cd MoodStudy
   ```

2. **Configure environment variables**
   - Copy the example config file:
     ```bash
     cp config.example.js config.js
     ```
   - Open `config.js` and fill in your credentials:
     ```javascript
     export const CONFIG = {
       SUPABASE_URL: 'your-supabase-url',
       SUPABASE_KEY: 'your-supabase-anon-key',
       HF_TOKEN: 'your-huggingface-token',
     };
     ```

3. **Set up Supabase database**
   - Create a Supabase project at [supabase.com](https://supabase.com)
   - Run the SQL schema from `milestones_table.sql` in your Supabase SQL editor
   - Get your project URL and anon key from the Supabase dashboard

4. **Get Hugging Face API token**
   - Sign up at [huggingface.co](https://huggingface.co)
   - Create an API token in your account settings
   - Add it to `config.js`(edit and rename `config.example.js` as an example)

5. **Run the application**
   - Since this is a static web application, you can:
     - Open `index.html` directly in your browser, or
     - Use a local development server:
       ```bash
       # Using Python
       python -m http.server 8000
       
       # Using Node.js (if you have http-server installed)
       npx http-server
       
       # Using PHP
       php -S localhost:8000
       ```
   - Navigate to `http://localhost:8000` in your browser

### Important Notes

- **Never commit `config.js`**: This file contains sensitive credentials and should be kept private
- The application uses ES6 modules, so it must be served over HTTP/HTTPS (not `file://`)
- Ensure your Supabase project has the necessary database tables and Row Level Security (RLS) policies configured

## Technologies Used

### Frontend
- **HTML5 & CSS3**: Modern semantic markup and styling
- **Vanilla JavaScript (ES6+)**: No framework dependencies, pure JavaScript
- **Three.js**: 3D graphics and visual effects for immersive UI
- **GSAP (GreenSock Animation Platform)**: Advanced animations and scroll-triggered effects
- **Lenis**: Smooth scrolling library for enhanced user experience

### Backend & Services
- **Supabase**: Backend-as-a-Service for authentication, database, and real-time features
- **Hugging Face API**: AI/LLM integration for personalized insights and recommendations

### Development Tools
- **Git**: Version control
- **Modern Browser DevTools**: For debugging and development

## Project Structure

```
MoodStudy/
├── index.html          # Landing page
├── dashboard.html      # Main dashboard
├── daily.html          # Daily mood/logging interface
├── profile.html        # User profile and academic goals
├── focus.html          # Pomodoro focus timer
├── simulator.html      # GPA simulation tool
├── history.html        # Mood and habit history/analytics
├── events.html         # Event and deadline tracking
├── config.js           # Configuration (not committed)
├── config.example.js   # Configuration template
├── supabaseClient.js   # Supabase client setup
├── app.js              # Main application logic
├── auth.js             # Authentication handlers
├── dashboard.js        # Dashboard functionality
├── style.css           # Main stylesheet
├── dashboard.css       # Dashboard-specific styles
├── milestones_table.sql # Database schema
└── assests/            # Images and audio files
```

## Demo Video

[![Watch the video](https://img.youtube.com)](https://moodstudy.top/assests/demoVideo.mp4)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

For issues, questions, or suggestions, please open an issue on the GitHub repository.

---

**Built with ❤️ and ☕️ for students and lifelong learners**
