import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import LoginPage from "./features/auth/LoginPage";
import SignupPage from "./features/auth/SignupPage";
import RequestSubmittedPage from "./features/auth/RequestSubmittedPage";
import AccountPendingPage from "./features/auth/AccountPendingPage";
import ChairmanLayout from "./features/chairman/ChairmanLayout";
import ChairmanDashboardPage from "./features/chairman/ChairmanDashboardPage";
import ChairmanReportsPage from "./features/chairman/ChairmanReportsPage";
import ChairmanReportExportPage from "./features/chairman/ChairmanReportExportPage";
import ChairmanSyncPage from "./features/chairman/ChairmanSyncPage";
import ChairmanSyncHistoryPage from "./features/chairman/ChairmanSyncHistoryPage";
import ChairmanSyncBatchPage from "./features/chairman/ChairmanSyncBatchPage";

import ChairmanNotificationsPage from "./features/chairman/ChairmanNotificationsPage";
import ChairmanAlertDetailPage from "./features/chairman/ChairmanAlertDetailPage";
import ChairmanProfileSettingsPage from "./features/chairman/ChairmanProfileSettingsPage";
import ChairmanSecurityPage from "./features/chairman/ChairmanSecurityPage";
import ChairmanNotificationPreferencesPage from "./features/chairman/ChairmanNotificationPreferencesPage";
import ChairmanEditProfilePage from "./features/chairman/ChairmanEditProfilePage";
import AdminLayout from "./features/admin/AdminLayout";
import DashboardPage from "./features/admin/DashboardPage";
import AccountRequestsPage from "./features/admin/AccountRequestsPage";
import ComingSoonPage from "./features/admin/ComingSoonPage";
import AdminHelpSupportPage from "./features/admin/AdminHelpSupportPage";
import BeneficiaryRegistryPage from "./features/admin/BeneficiaryRegistryPage";
import AddBeneficiaryPage from "./features/admin/AddBeneficiaryPage";
import BeneficiaryDetailPage from "./features/admin/BeneficiaryDetailPage";
import EditBeneficiaryPage from "./features/admin/EditBeneficiaryPage";
import BeneficiaryIdDirectoryPage from "./features/admin/BeneficiaryIdDirectoryPage";
import GenerateQrPage from "./features/admin/GenerateQrPage";
import BeneficiaryIdPreviewPage from "./features/admin/BeneficiaryIdPreviewPage";
import UserRoleManagementPage from "./features/admin/UserRoleManagementPage";
import InviteStaffPage from "./features/admin/InviteStaffPage";
import ApprovalRequestReviewPage from "./features/admin/ApprovalRequestReviewPage";
import ManageAccessTabPage from "./features/admin/ManageAccessTabPage";
import RolePermissionsPage from "./features/admin/RolePermissionsPage";
import AccessAuditPage from "./features/admin/AccessAuditPage";
import AdminNotificationsPage from "./features/admin/notifications/NotificationsPage";
import AdminAlertDetailPage from "./features/admin/notifications/AlertDetailPage";
import AdminProfileSettingsPage from "./features/admin/profile-settings/ProfileSettingsPage";
import AdminEditProfilePage from "./features/admin/profile-settings/EditProfilePage";
import AdminSecurityPage from "./features/admin/profile-settings/SecurityPage";
import AdminNotificationPreferencesPage from "./features/admin/profile-settings/NotificationPreferencesPage";
import BhwLayout from "./features/bhw/BhwLayout";
import BhwDashboardPage from "./features/bhw/BhwDashboardPage";
import MedicineInventoryPage from "./features/bhw/MedicineInventoryPage";
import BhwBeneficiariesPage from "./features/bhw/BeneficiariesPage";
import BhwBeneficiaryDetailPage from "./features/bhw/BeneficiaryDetailPage";
import BhwAddEditClinicalRecordPage from "./features/bhw/AddEditClinicalRecordPage";
import RestockEntryPage from "./features/bhw/RestockEntryPage";
import ClinicalRecordsPage from "./features/bhw/ClinicalRecordsPage";
import ClinicalRecordDetailPage from "./features/bhw/ClinicalRecordDetailPage";
import EditClinicalRecordPage from "./features/bhw/EditClinicalRecordPage";
import AddMedicalHistoryPage from "./features/bhw/AddMedicalHistoryPage";
import TransactionHistoryPage from "./features/bhw/TransactionHistoryPage";
import DispensingReceiptPage from "./features/bhw/DispensingReceiptPage";
import MachineMonitoringPage from "./features/bhw/MachineMonitoringPage";
import MachineMaintenancePage from "./features/bhw/MachineMaintenancePage";
import AlertDetailPage from "./features/bhw/AlertDetailPage";
import NotificationsPage from "./features/bhw/NotificationsPage";
import ProfileSettingsPage from "./features/bhw/ProfileSettingsPage";
import EditProfilePage from "./features/bhw/EditProfilePage";
import SecurityPage from "./features/bhw/SecurityPage";
import NotificationPreferencesPage from "./features/bhw/NotificationPreferencesPage";
import HelpSupportPage from "./features/bhw/HelpSupportPage";
import SyncHistoryPage from "./features/bhw/SyncHistoryPage";
// Scan & dispense lazy-loaded — pulls in the QR scanner libraries on demand.
const ScanDispensePage = lazy(() => import("./features/bhw/ScanDispensePage"));
import RequireRole from "./features/auth/RequireRole";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/request-submitted" element={<RequestSubmittedPage />} />
        <Route path="/account-pending" element={<AccountPendingPage />} />

        {/* Secretary (Admin) */}
        <Route
          path="/admin"
          element={
            <RequireRole role="admin">
              <AdminLayout />
            </RequireRole>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="requests" element={<AccountRequestsPage />} />
          <Route path="beneficiaries" element={<BeneficiaryRegistryPage />} />
          <Route path="beneficiaries/new" element={<AddBeneficiaryPage />} />
          <Route path="beneficiaries/:id" element={<BeneficiaryDetailPage />} />
          <Route path="beneficiaries/:id/edit" element={<EditBeneficiaryPage />} />
          <Route path="users" element={<UserRoleManagementPage />} />
          <Route path="users/invite" element={<InviteStaffPage />} />
          <Route path="users/manage-access" element={<ManageAccessTabPage />} />
          <Route path="users/role-permissions" element={<RolePermissionsPage />} />
          <Route path="users/access-audit" element={<AccessAuditPage />} />
          <Route path="users/requests/:id" element={<ApprovalRequestReviewPage />} />
          <Route path="ids" element={<BeneficiaryIdDirectoryPage />} />
          <Route path="beneficiaries/:id/qr" element={<GenerateQrPage />} />
          <Route path="beneficiaries/:id/id" element={<BeneficiaryIdPreviewPage />} />
          <Route path="help" element={<AdminHelpSupportPage />} />
          {/* Shared workspace pages (copied from BHW for the admin role) */}
          <Route path="transactions" element={<TransactionHistoryPage />} />
          <Route path="dispensing/:id" element={<DispensingReceiptPage />} />
          <Route path="reports" element={<ChairmanReportsPage />} />
          <Route path="reports/export" element={<ChairmanReportExportPage />} />
          <Route path="notifications" element={<AdminNotificationsPage />} />
          <Route path="notifications/:alertId" element={<AdminAlertDetailPage />} />
          <Route path="profile" element={<AdminProfileSettingsPage />} />
          <Route path="profile/security" element={<AdminSecurityPage />} />
          <Route path="profile/notifications" element={<AdminNotificationPreferencesPage />} />
          <Route path="profile/edit" element={<AdminEditProfilePage />} />
          <Route path="sync" element={<SyncHistoryPage />} />
          {/* Placeholder for admin sections that aren't built yet */}
          <Route path="*" element={<ComingSoonPage />} />
        </Route>

        {/* BHW */}
        <Route
          path="/bhw"
          element={
            <RequireRole role="bhw">
              <BhwLayout />
            </RequireRole>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<BhwDashboardPage />} />
          <Route path="inventory" element={<MedicineInventoryPage />} />
          <Route path="restock" element={<RestockEntryPage />} />
          <Route path="beneficiaries" element={<BhwBeneficiariesPage />} />
          <Route path="beneficiaries/:id" element={<BhwBeneficiaryDetailPage />} />
          <Route path="beneficiaries/:id/clinical/new" element={<BhwAddEditClinicalRecordPage />} />
          <Route path="beneficiaries/:id/clinical/:recordId/edit" element={<BhwAddEditClinicalRecordPage />} />
          <Route path="transactions" element={<TransactionHistoryPage />} />
          <Route path="scan-dispense" element={<Suspense fallback={null}><ScanDispensePage /></Suspense>} />
          <Route path="dispensing/:id" element={<DispensingReceiptPage />} />
          <Route path="machine" element={<MachineMonitoringPage />} />
          <Route path="machine/maintenance" element={<MachineMaintenancePage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<ProfileSettingsPage />} />
          <Route path="profile/security" element={<SecurityPage />} />
          <Route path="profile/notifications" element={<NotificationPreferencesPage />} />
          <Route path="profile/edit" element={<EditProfilePage />} />
          <Route path="help" element={<HelpSupportPage />} />
          <Route path="sync" element={<SyncHistoryPage />} />
          <Route path="notifications/:alertId" element={<AlertDetailPage />} />
          <Route path="clinical-records" element={<ClinicalRecordsPage />} />
          <Route path="clinical-records/:id" element={<ClinicalRecordDetailPage />} />
          <Route path="clinical-records/:id/edit" element={<EditClinicalRecordPage />} />
          <Route
            path="clinical-records/:id/add-history"
            element={<AddMedicalHistoryPage />}
          />
          {/* Placeholder for BHW sections that aren't built yet */}
          <Route path="*" element={<ComingSoonPage />} />
        </Route>

        {/* Chairman */}
        <Route
          path="/chairman"
          element={
            <RequireRole role="chairman">
              <ChairmanLayout />
            </RequireRole>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ChairmanDashboardPage />} />
          <Route path="reports" element={<ChairmanReportsPage />} />
          <Route path="reports/export" element={<ChairmanReportExportPage />} />
          <Route path="sync" element={<ChairmanSyncPage />} />
          <Route path="sync/history" element={<ChairmanSyncHistoryPage />} />
          <Route path="sync/history/:batchId" element={<ChairmanSyncBatchPage />} />

          <Route path="notifications" element={<ChairmanNotificationsPage />} />
          <Route path="notifications/:alertId" element={<ChairmanAlertDetailPage />} />
          <Route path="profile" element={<ChairmanProfileSettingsPage />} />
          <Route path="profile/security" element={<ChairmanSecurityPage />} />
          <Route path="profile/notifications" element={<ChairmanNotificationPreferencesPage />} />
          <Route path="profile/edit" element={<ChairmanEditProfilePage />} />
          {/* Placeholder for chairman sections that aren't built yet */}
          <Route path="*" element={<ComingSoonPage />} />
        </Route>

        {/* Default */}
        <Route path="/" element={<LoginPage />} />
      </Routes>
    </BrowserRouter>
  );
}