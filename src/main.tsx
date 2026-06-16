import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './index.css';
import { AuthProvider } from './auth/AuthProvider';

import AdminRoute from './auth/AdminRoute';
import AppShell from './layout/AppShell';

import LoginPage from './pages/LoginPage';
import JoinPage from './pages/JoinPage';
import NoTenantPage from './pages/NoTenantPage';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients/Clients';
import ClientDetail from './pages/Clients/ClientDetail';
import Cases from './pages/Cases/Cases';
import CaseDetail from './pages/Cases/CaseDetail';
import Contacts from './pages/Contacts/Contacts';
import ContactDetail from './pages/Contacts/ContactDetail';
import Calls from './pages/Calls/Calls';
import CallDetail from './pages/Calls/CallDetail';
import Tasks from './pages/Tasks/Tasks';
import TaskDetail from './pages/Tasks/TaskDetail';
import Finances from './pages/Finances/Finances';
import UsersSettings from './pages/Settings/Users';
import ContactRoles from './pages/Settings/ContactRoles';
import CaseStages from './pages/Settings/CaseStages';
import CategoryRates from './pages/Settings/CategoryRates';

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/join', element: <JoinPage /> },
  { path: '/no-tenant', element: <NoTenantPage /> },
  {
    path: '/',
    element: (
      <AdminRoute>
        <AppShell />
      </AdminRoute>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'clients', element: <Clients /> },
      { path: 'clients/:id', element: <ClientDetail /> },
      { path: 'cases', element: <Cases /> },
      { path: 'cases/:id', element: <CaseDetail /> },
      { path: 'contacts', element: <Contacts /> },
      { path: 'contacts/:id', element: <ContactDetail /> },
      { path: 'calls', element: <Calls /> },
      { path: 'calls/:id', element: <CallDetail /> },
      { path: 'tasks', element: <Tasks /> },
      { path: 'tasks/:id', element: <TaskDetail /> },
      { path: 'finances', element: <Finances /> },
      { path: 'settings/users', element: <UsersSettings /> },
      { path: 'settings/contact-roles', element: <ContactRoles /> },
      { path: 'settings/case-stages', element: <CaseStages /> },
      { path: 'settings/category-rates', element: <CategoryRates /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>
);
