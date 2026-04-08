import { Routes, Route } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import SubjectList from './components/SubjectList';
import TopicList from './components/TopicList';
import SubtopicList from './components/SubtopicList';
import SubtopicDetail from './components/SubtopicDetail';
import ContentView from './components/ContentView';
import Quiz from './components/Quiz';

function Header() {
  const navigate = useNavigate();
  return (
    <header className="app-header" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
      <div className="header-inner">
        <span className="header-icon">📚</span>
        <h1>Self-Learn Quiz</h1>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="app">
      <Header />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<SubjectList />} />
          <Route path="/subject/:subjectId" element={<TopicList />} />
          <Route path="/subject/:subjectId/topic/:topicId" element={<SubtopicList />} />
          <Route path="/subject/:subjectId/topic/:topicId/subtopic/:subtopicId" element={<SubtopicDetail />} />
          <Route path="/subject/:subjectId/topic/:topicId/subtopic/:subtopicId/content" element={<ContentView />} />
          <Route path="/subject/:subjectId/topic/:topicId/subtopic/:subtopicId/quiz" element={<Quiz />} />
        </Routes>
      </main>
    </div>
  );
}
