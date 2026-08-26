import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Dashboard } from './screens/Dashboard';
import { SettingsScreen } from './screens/Settings';
import { CorpusScreen } from './screens/Corpus';
import { ProjectLayout } from './screens/ProjectLayout';
import { Overview } from './screens/Overview';
import { GenreCoverage } from './screens/GenreCoverage';
import { StructureScreen } from './screens/Structure';
import { CharactersScreen } from './screens/Characters';
import { ArcMatrixScreen } from './screens/ArcMatrix';
import { SceneScreen } from './screens/SceneScreen';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/corpus" element={<CorpusScreen />} />
        <Route path="/p/:projectId" element={<ProjectLayout />}>
          <Route index element={<Overview />} />
          <Route path="genre" element={<GenreCoverage />} />
          <Route path="structure" element={<StructureScreen />} />
          <Route path="characters" element={<CharactersScreen />} />
          <Route path="matrix" element={<ArcMatrixScreen />} />
          <Route path="scene/:sceneId" element={<SceneScreen />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
