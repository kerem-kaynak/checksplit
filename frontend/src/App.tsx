import { Routes, Route, useLocation } from "react-router-dom";
import { Home } from "@/pages/Home";
import { CreateCheck } from "@/pages/CreateCheck";
import { ScanReceipt } from "@/pages/ScanReceipt";
import { JoinCheck } from "@/pages/JoinCheck";
import { CheckSuccess } from "@/pages/CheckSuccess";
import { ViewCheck } from "@/pages/ViewCheck";
import { EditCheck } from "@/pages/EditCheck";
import { PageTransition } from "@/components/PageTransition";

function App() {
  const location = useLocation();

  return (
    <PageTransition key={location.pathname}>
      <Routes location={location}>
        <Route path="/" element={<Home />} />
        <Route path="/create" element={<CreateCheck />} />
        <Route path="/create/scan" element={<ScanReceipt />} />
        <Route path="/join" element={<JoinCheck />} />
        <Route path="/check/:code/success" element={<CheckSuccess />} />
        <Route path="/check/:code/edit" element={<EditCheck />} />
        <Route path="/check/:code" element={<ViewCheck />} />
      </Routes>
    </PageTransition>
  );
}

export default App;
