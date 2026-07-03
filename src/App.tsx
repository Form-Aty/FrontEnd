import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './store/auth';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { VerifySchool } from './pages/VerifySchool';
import { Welcome } from './pages/Welcome';
import { Feed } from './pages/Feed';
import { SurveyDetail } from './pages/SurveyDetail';
import { ResponseDone } from './pages/ResponseDone';
import { SurveyFill } from './pages/SurveyFill';
import { SurveyResults } from './pages/SurveyResults';
import { SurveyBuilder } from './pages/SurveyBuilder';
import { MySurveys } from './pages/MySurveys';
import { AiWizard } from './pages/AiWizard';
import { MyPage } from './pages/MyPage';
import { Credits } from './pages/Credits';
import { Teams } from './pages/Teams';
import { TeamDetail } from './pages/TeamDetail';

function Protected({ children }: { children: ReactNode }) {
  const authed = useAuth((s) => s.authed);
  return authed ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Navigate to="/verify" replace />} />
      <Route path="/verify" element={<VerifySchool />} />
      <Route path="/welcome" element={<Welcome />} />

      <Route path="/home" element={<Protected><Navigate to="/feed" replace /></Protected>} />
      <Route path="/feed" element={<Protected><Feed /></Protected>} />
      <Route path="/surveys/new" element={<Protected><SurveyBuilder /></Protected>} />
      <Route path="/surveys/:id/edit" element={<Protected><SurveyBuilder /></Protected>} />
      <Route path="/surveys/:id" element={<Protected><SurveyDetail /></Protected>} />
      <Route path="/surveys/:id/fill" element={<Protected><SurveyFill /></Protected>} />
      <Route path="/surveys/:id/done" element={<Protected><ResponseDone /></Protected>} />
      <Route path="/surveys/:id/results" element={<Protected><SurveyResults /></Protected>} />
      <Route path="/my-surveys" element={<Protected><MySurveys /></Protected>} />
      <Route path="/ai" element={<Protected><AiWizard /></Protected>} />
      <Route path="/me" element={<Protected><MyPage /></Protected>} />
      <Route path="/credits" element={<Protected><Credits /></Protected>} />
      <Route path="/teams" element={<Protected><Teams /></Protected>} />
      <Route path="/teams/:id" element={<Protected><TeamDetail /></Protected>} />

      <Route path="*" element={<Navigate to="/feed" replace />} />
    </Routes>
  );
}
