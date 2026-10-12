// import { useEffect, useState } from "react";
// import Sidebar from "./components/layout/Sidebar";
// import Topbar from "./components/layout/Topbar";
// import { DashboardProvider } from "./context/DashboardContext";
// import { ToastProvider } from "./components/common/Toast";
// import Tooltip from "./components/common/Tooltip";
// import RefreshBanner from "./components/common/RefreshBanner";
// import { readPrefs, writePrefs } from "./utils/prefs";
// import Overview from "./pages/Overview";
// import Conversations from "./pages/Conversations";
// import Referrals from "./pages/Referrals";
// import Audiences from "./pages/Audiences";
// import StoreVisits from "./pages/StoreVisits";

// const VIEWS = ["overview", "conversations", "referrals", "audiences", "visits"];

// function DashboardApp() {
//   // Opens on the page last used in this browser.
//   const [view, setView] = useState(() => (VIEWS.includes(readPrefs().view) ? readPrefs().view : "overview"));

//   useEffect(() => {
//     writePrefs({ view });
//   }, [view]);

//   const page = {
//     overview: <Overview />,
//     conversations: <Conversations />,
//     referrals: <Referrals />,
//     audiences: <Audiences />,
//     visits: <StoreVisits />
//   }[view];

//   return (
//     <div className="min-h-screen bg-kc-bg text-kc-ink">
//       <div className="flex min-h-screen">
//         <Sidebar view={view} onNavigate={setView} />

//         <main className="flex min-w-0 flex-1 flex-col">
//           <Topbar view={view} onNavigate={setView} />

//           <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-5 px-4 pb-11 pt-[18px] lg:pl-7 lg:pr-[34px]">
//             <RefreshBanner />
//             {page}
//           </div>
//         </main>
//       </div>
//       <Tooltip />
//     </div>
//   );
// }

// export default function App() {
//   return (
//     <DashboardProvider>
//       <ToastProvider>
//         <DashboardApp />
//       </ToastProvider>
//     </DashboardProvider>
//   );
// }



import { useEffect, useState } from "react";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import { DashboardProvider } from "./context/DashboardContext";
import { ToastProvider } from "./components/common/Toast";
import Tooltip from "./components/common/Tooltip";
import RefreshBanner from "./components/common/RefreshBanner";
import { readPrefs, writePrefs } from "./utils/prefs";
import Overview from "./pages/Overview";
import Conversations from "./pages/Conversations";
import Referrals from "./pages/Referrals";
import Audiences from "./pages/Audiences";
import StoreVisits from "./pages/StoreVisits";
import Login from "./pages/Login";
import { me, logout, UNAUTHORIZED_EVENT } from "./services/authApi";

const VIEWS = ["overview", "conversations", "referrals", "audiences", "visits"];

function DashboardApp({ user, onLogout }) {
  // Opens on the page last used in this browser.
  const [view, setView] = useState(() => (VIEWS.includes(readPrefs().view) ? readPrefs().view : "overview"));

  useEffect(() => {
    writePrefs({ view });
  }, [view]);

  const page = {
    overview: <Overview />,
    conversations: <Conversations />,
    referrals: <Referrals />,
    audiences: <Audiences />,
    visits: <StoreVisits />
  }[view];

  return (
    <div className="min-h-screen bg-kc-bg text-kc-ink">
      <div className="flex min-h-screen">
        <Sidebar view={view} onNavigate={setView} />

        <main className="flex min-w-0 flex-1 flex-col">
          <Topbar view={view} onNavigate={setView} user={user} onLogout={onLogout} />

          <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-5 px-4 pb-11 pt-3.5 lg:pl-7 lg:pr-[34px]">
            <RefreshBanner />
            {page}
          </div>
        </main>
      </div>
      <Tooltip />
    </div>
  );
}

export default function App() {
  // checking -> in / out
  const [auth, setAuth] = useState({ status: "checking", user: null });

  // Page khulte hi: kya session abhi bhi valid hai?
  useEffect(() => {
    me()
      .then((user) => setAuth(user ? { status: "in", user } : { status: "out", user: null }))
      .catch(() => setAuth({ status: "out", user: null }));
  }, []);

  // Kisi bhi API par 401 (session expire) -> login page
  useEffect(() => {
    const onUnauthorized = () => setAuth({ status: "out", user: null });
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  async function handleLogout() {
    await logout();
    setAuth({ status: "out", user: null });
  }

  if (auth.status === "checking") {
    return <div className="flex min-h-screen items-center justify-center bg-kc-bg text-kc-ink">Loading…</div>;
  }

  if (auth.status === "out") {
    return <Login onLoggedIn={(user) => setAuth({ status: "in", user })} />;
  }

  // Dashboard data sirf login ke baad load hota hai
  return (
    <DashboardProvider>
      <ToastProvider>
        <DashboardApp user={auth.user} onLogout={handleLogout} />
      </ToastProvider>
    </DashboardProvider>
  );
}