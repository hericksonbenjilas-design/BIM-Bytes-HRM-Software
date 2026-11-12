import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  UserPlus,
  Edit3,
  Trash2,
  Clock,
  Laptop,
  CheckCircle2,
  Building2,
  Shield,
  Calendar,
  IndianRupee,
  X,
  Plus,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  User,
  JobAssignment,
  PROJECTS,
  TASKS,
  SUBTASKS,
  ALL_USER_ROLES,
  EMPLOYMENT_STATUSES,
  EmploymentStatus,
  PriorityLevel,
  PRIORITY_LEVELS,
} from '../constants';

interface SessionRecord {
  id?: number | string;
  username: string;
  workHours?: number;
  project?: string;
  task?: string;
  subtask?: string;
  date?: string;
}

interface EmployeesDetailsTabProps {
  currentUser: User;
  employeesList: User[];
  allSessions: SessionRecord[];
  jobAssignments: JobAssignment[];
  darkMode: boolean;
  onRefreshBootstrap: () => void;
  showBanner: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onNavigateToTracker?: () => void;
  onNavigateToPayroll?: () => void;
}

export const EmployeesDetailsTab: React.FC<EmployeesDetailsTabProps> = ({
  currentUser,
  employeesList,
  allSessions,
  jobAssignments,
  darkMode,
  onRefreshBootstrap,
  showBanner,
  onNavigateToTracker,
  onNavigateToPayroll,
}) => {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | EmploymentStatus>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');

  // Selected Employee Modal for Full Details Editing
  const [selectedEmp, setSelectedEmp] = useState<User | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<User>>({});
  const [savingEmp, setSavingEmp] = useState<boolean>(false);

  // Add Employee Modal
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false);
  const [newEmpName, setNewEmpName] = useState<string>('');
  const [newEmpCode, setNewEmpCode] = useState<string>('1055');
  const [newEmpRole, setNewEmpRole] = useState<string>('Production');
  const [newEmpDept, setNewEmpDept] = useState<string>('MEP-MECHANICAL');
  const [newEmpDesig, setNewEmpDesig] = useState<string>('BIM MODELER-MECHANICAL');
  const [newEmpShiftIn, setNewEmpShiftIn] = useState<string>('9:00 AM');
  const [newEmpWorkHrs, setNewEmpWorkHrs] = useState<string>('9');
  const [newEmpShiftOut, setNewEmpShiftOut] = useState<string>('6:00 PM');
  const [newEmpAllSatOff, setNewEmpAllSatOff] = useState<boolean>(false);
  const [newEmpMonthlySal, setNewEmpMonthlySal] = useState<string>('23500');
  const [newEmpHourlySal, setNewEmpHourlySal] = useState<string>('110');
  const [newEmpReportsTo, setNewEmpReportsTo] = useState<string>('SONAIMUTHU V');
  const [newEmpStatus, setNewEmpStatus] = useState<EmploymentStatus>('Active');
  const [newEmpBankName, setNewEmpBankName] = useState<string>('-');
  const [newEmpBankAcc, setNewEmpBankAcc] = useState<string>('-');
  const [newEmpIfsc, setNewEmpIfsc] = useState<string>('-');

  // Quick Assign / Split Per-Day Time Modal for an Employee
  const [assignModalEmp, setAssignModalEmp] = useState<User | null>(null);
  const [quickProject, setQuickProject] = useState<string>('CMRL');
  const [quickTask, setQuickTask] = useState<string>('Modeling');
  const [quickSubtask, setQuickSubtask] = useState<string>('HVAC');
  const [quickHours, setQuickHours] = useState<string>('8');
  const [quickPriority, setQuickPriority] = useState<PriorityLevel>('High');
  const [quickStage, setQuickStage] = useState<'handover_pool' | 'split_member' | 'direct'>('direct');
  const [quickMainHandover, setQuickMainHandover] = useState<string>('SENTHIL KUMAR G');
  const [quickNotes, setQuickNotes] = useState<string>('');

  const uniqueDepartments = useMemo(() => {
    const set = new Set<string>();
    employeesList.forEach((e) => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set).sort();
  }, [employeesList]);

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return employeesList.filter((e) => {
      const st = (e.employmentStatus || 'Active') as EmploymentStatus;
      if (statusFilter !== 'ALL' && st !== statusFilter) return false;
      if (roleFilter !== 'ALL' && e.role !== roleFilter) return false;
      if (deptFilter !== 'ALL' && (e.department || 'MEP-BIM') !== deptFilter) return false;
      if (!q) return true;
      return (
        e.username.toLowerCase().includes(q) ||
        (e.empCode || '').toLowerCase().includes(q) ||
        (e.designation || '').toLowerCase().includes(q) ||
        (e.department || '').toLowerCase().includes(q) ||
        (e.reportsTo || '').toLowerCase().includes(q) ||
        (e.role || '').toLowerCase().includes(q)
      );
    });
  }, [employeesList, searchQuery, statusFilter, roleFilter, deptFilter]);

  // Per-employee logged hours & assigned daily hours map
  const empMetricsMap = useMemo(() => {
    const map: Record<
      string,
      {
        loggedHours: number;
        screenHours: number;
        assignedDailyHours: number;
        poolHoursOwned: number;
        jobs: JobAssignment[];
      }
    > = {};

    employeesList.forEach((e) => {
      map[e.username] = {
        loggedHours: 0,
        screenHours: Number(e.screenTimeHours ?? 158),
        assignedDailyHours: 0,
        poolHoursOwned: 0,
        jobs: [],
      };
    });

    allSessions.forEach((s) => {
      if (!map[s.username]) {
        map[s.username] = {
          loggedHours: 0,
          screenHours: 0,
          assignedDailyHours: 0,
          poolHoursOwned: 0,
          jobs: [],
        };
      }
      map[s.username].loggedHours += Number(s.workHours || 0);
    });

    jobAssignments.forEach((j) => {
      if (!map[j.employee]) {
        map[j.employee] = {
          loggedHours: 0,
          screenHours: 0,
          assignedDailyHours: 0,
          poolHoursOwned: 0,
          jobs: [],
        };
      }
      map[j.employee].jobs.push(j);
      if (j.assignmentStage === 'handover_pool') {
        map[j.employee].poolHoursOwned += Number(j.allocatedHours ?? 8);
      } else {
        map[j.employee].assignedDailyHours += Number(j.allocatedHours ?? 8);
      }
    });

    return map;
  }, [employeesList, allSessions, jobAssignments]);

  const openEditEmployeeModal = (emp: User) => {
    setSelectedEmp(emp);
    setEditDraft({
      empCode: emp.empCode || '1001',
      role: emp.role || 'Production',
      department: emp.department || 'MEP-BIM',
      designation: emp.designation || 'BIM MODELER',
      reportsTo: emp.reportsTo || 'Rebecca Mary',
      employmentStatus: (emp.employmentStatus || 'Active') as EmploymentStatus,
      shiftIn: emp.shiftIn || '9:00 AM',
      workingHours: Number(emp.workingHours ?? 9),
      shiftOut: emp.shiftOut || '6:00 PM',
      allSaturdaysOff: Boolean(emp.allSaturdaysOff),
      monthlySalary: Number(emp.monthlySalary ?? 23500),
      hourlySalary: Number(emp.hourlySalary ?? 110),
      screenTimeHours: Number(emp.screenTimeHours ?? 162),
      lunchBreakStart: emp.lunchBreakStart || '13:00',
      lunchBreakEnd: emp.lunchBreakEnd || '13:45',
      teaBreakStart: emp.teaBreakStart || '17:00',
      teaBreakEnd: emp.teaBreakEnd || '17:15',
      workLocation: emp.workLocation || 'BIM BYTES SOLUTIONS',
      uanNumber: emp.uanNumber || '-',
      bankName: emp.bankName || '-',
      bankAccountNo: emp.bankAccountNo || '-',
      ifscCode: emp.ifscCode || '-',
      branchName: emp.branchName || '-',
      pfNumber: emp.pfNumber || '-',
      esicNumber: emp.esicNumber || '-',
      joiningDate: emp.joiningDate || '2024-01-10',
      emergencyContact: emp.emergencyContact || '+91 98400 00000',
      address: emp.address || 'Avadi, Chennai',
    });
  };

  const handleSaveEmployeeDetails = async (
    username: string,
    updates: Partial<User>,
    closeAfter = false
  ) => {
    setSavingEmp(true);
    try {
      const res = await fetch('/api/employees/update-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          ...updates,
          actor: currentUser.username,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onRefreshBootstrap();
        showBanner(`Updated employee details for ${username}.`, 'success');
        if (closeAfter) setSelectedEmp(null);
      } else {
        showBanner(data.message || 'Failed to update employee details.', 'error');
      }
    } catch {
      showBanner('Network error while saving employee details.', 'error');
    } finally {
      setSavingEmp(false);
    }
  };

  const handleAddNewEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName.trim()) {
      showBanner('Enter employee full name.', 'error');
      return;
    }
    const res = await fetch('/api/employees/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: newEmpName.trim().toUpperCase(),
        password: '1234',
        empCode: newEmpCode.trim(),
        role: newEmpRole,
        department: newEmpDept,
        designation: newEmpDesig,
        shiftIn: newEmpShiftIn,
        workingHours: Number(newEmpWorkHrs) || 9,
        shiftOut: newEmpShiftOut,
        allSaturdaysOff: newEmpAllSatOff,
        monthlySalary: Number(newEmpMonthlySal) || 23500,
        hourlySalary: Number(newEmpHourlySal) || 110,
        reportsTo: newEmpReportsTo,
        employmentStatus: newEmpStatus,
        bankName: newEmpBankName || '-',
        bankAccountNo: newEmpBankAcc || '-',
        ifscCode: newEmpIfsc || '-',
        workLocation: 'BIM BYTES SOLUTIONS',
        actor: currentUser.username,
      }),
    });
    const data = await res.json();
    if (data.success) {
      setNewEmpName('');
      setNewEmpCode(String(Number(newEmpCode || 1055) + 1));
      setAddModalOpen(false);
      onRefreshBootstrap();
      showBanner(`Added ${newEmpName.toUpperCase()} to Employees Details roster.`, 'success');
    } else {
      showBanner(data.message || 'Could not add employee.', 'error');
    }
  };

  const handleRemoveEmployee = async (username: string) => {
    if (username === currentUser.username) {
      showBanner('You cannot delete your own active account.', 'error');
      return;
    }
    const res = await fetch('/api/employees/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, actor: currentUser.username }),
    });
    const data = await res.json();
    if (data.success) {
      onRefreshBootstrap();
      if (selectedEmp?.username === username) setSelectedEmp(null);
      showBanner(`Removed ${username} from the employee directory.`, 'info');
    }
  };

  const handleQuickAssignWorkTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalEmp) return;
    const hrs = Number(quickHours) || 8;
    const res = await fetch('/api/assignments/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee: assignModalEmp.username,
        project: quickProject,
        task: quickTask,
        subtask: quickSubtask,
        priority: quickPriority,
        allocatedHours: hrs,
        assignmentStage: quickStage,
        mainHandover:
          quickStage === 'handover_pool'
            ? assignModalEmp.username
            : quickMainHandover || currentUser.username,
        assignedBy: currentUser.username,
        assignedByRole: currentUser.role,
        notes:
          quickNotes ||
          (quickStage === 'handover_pool'
            ? `Per-Day Main Handover Time Pool (${hrs}h/day) assigned by ${currentUser.username} (${currentUser.role})`
            : `Per-Day Split/Assigned Work (${hrs}h/day) — automatically loaded in Time Tracker`),
      }),
    });
    const data = await res.json();
    if (data.success) {
      onRefreshBootstrap();
      setAssignModalEmp(null);
      setQuickNotes('');
      showBanner(
        `Assigned ${hrs} hrs/day (${quickProject} · ${quickTask} · ${quickSubtask}) to ${assignModalEmp.username}. Available in Time Tracker!`,
        'success'
      );
    }
  };

  const statusBadgeClass = (st?: string) => {
    switch (st) {
      case 'Active':
        return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300';
      case 'Inactive':
        return 'border-amber-500/40 bg-amber-500/15 text-amber-300';
      case 'Left':
        return 'border-slate-500/40 bg-slate-500/15 text-slate-300';
      case 'Terminated':
        return 'border-red-500/40 bg-red-500/15 text-red-300';
      default:
        return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300';
    }
  };

  const totalActiveCount = employeesList.filter(
    (e) => (e.employmentStatus || 'Active') === 'Active'
  ).length;
  const mainHandoversList = employeesList.filter((e) =>
    ['Main Handover', 'Coordinator', 'Manager', 'Founder', 'HR'].includes(e.role)
  );

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div
        className={`rounded-2xl border p-6 shadow-xl ${
          darkMode ? 'border-slate-800 bg-[#121620]' : 'border-slate-200 bg-white'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-[#cc0000]/15 border border-[#cc0000]/40 px-2.5 py-0.5 font-heading text-[11px] font-bold uppercase tracking-wider text-red-400">
                BIM BYTES SOLUTIONS · MASTER DIRECTORY
              </span>
              <span className="rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 font-mono-tabular text-[11px] font-semibold text-emerald-300">
                All Employee Fields 100% Editable
              </span>
            </div>
            <h2 className="font-heading text-xl sm:text-2xl font-bold uppercase tracking-wider mt-1.5">
              Employees Details, Shifts, Per-Day Assigned Time & Statutory Profiles
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              View and edit every employee&apos;s Emp ID, Role, Department, Designation, Shift Hours, Reports To, Status (Active / Inactive / Left / Terminated), Salary, Screen Time, Bank Details, and Per-Day Time Tracker Assignments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex rounded-xl border border-slate-700 bg-[#0b0e14] p-1">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`rounded-lg px-3 py-1.5 font-heading text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-[#cc0000] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Profile Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`rounded-lg px-3 py-1.5 font-heading text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-[#cc0000] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Editable Sheet Table
              </button>
            </div>

            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 font-heading text-xs font-bold uppercase tracking-wider text-white shadow-lg cursor-pointer"
            >
              <UserPlus className="w-4 h-4" /> + Add Employee
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
          <div className="rounded-xl border border-slate-800 bg-[#0b0e14] p-3.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total Employees
            </div>
            <div className="font-mono-tabular text-2xl font-black text-white mt-1">
              {employeesList.length}
            </div>
            <div className="text-[11px] text-emerald-400 mt-0.5">
              {totalActiveCount} Active · {employeesList.length - totalActiveCount} Inactive/Left/Term
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0b0e14] p-3.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Leadership & Handovers
            </div>
            <div className="font-mono-tabular text-2xl font-black text-amber-400 mt-1">
              {mainHandoversList.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Founder, HR, Manager, Coordinator, Main Handover
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0b0e14] p-3.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Active Per-Day Assigned Jobs
            </div>
            <div className="font-mono-tabular text-2xl font-black text-sky-400 mt-1">
              {jobAssignments.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Synced directly to Time Tracker
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0b0e14] p-3.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Your Logged-In Profile
            </div>
            <div className="text-sm font-bold text-white truncate mt-1">
              {currentUser.username}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5">
              <span>Role: {currentUser.role}</span>
              <button
                type="button"
                onClick={() => {
                  const me =
                    employeesList.find((e) => e.username === currentUser.username) ||
                    currentUser;
                  openEditEmployeeModal(me);
                }}
                className="text-red-400 hover:underline font-semibold cursor-pointer"
              >
                Edit My Details →
              </button>
            </div>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, Emp ID (1001..), role, department..."
              className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] pl-9 pr-3 py-2 text-xs text-white focus:border-[#cc0000] focus:outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-xs text-white"
          >
            <option value="ALL">All Employment Statuses ({employeesList.length})</option>
            {EMPLOYMENT_STATUSES.map((st) => (
              <option key={st} value={st}>
                Status: {st}
              </option>
            ))}
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-xs text-white"
          >
            <option value="ALL">All System Roles</option>
            {ALL_USER_ROLES.map((r) => (
              <option key={r} value={r}>
                Role: {r}
              </option>
            ))}
          </select>

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-xs text-white"
          >
            <option value="ALL">All Departments</option>
            {uniqueDepartments.map((d) => (
              <option key={d} value={d}>
                Dept: {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* =====================================================================
          MODE A: DETAILED EMPLOYEE PROFILE CARDS
      ===================================================================== */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredEmployees.map((emp, idx) => {
            const m = empMetricsMap[emp.username] || {
              loggedHours: 0,
              screenHours: Number(emp.screenTimeHours ?? 158),
              assignedDailyHours: 0,
              poolHoursOwned: 0,
              jobs: [],
            };
            const empStatus = (emp.employmentStatus || 'Active') as EmploymentStatus;
            const code = emp.empCode || String(1001 + idx);

            return (
              <div
                key={emp.username}
                className={`rounded-2xl border p-5 shadow-lg transition-all flex flex-col justify-between ${
                  darkMode
                    ? 'border-slate-800 bg-[#121620] hover:border-slate-700'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div>
                  {/* Card Top: Avatar + Name + Code + Status */}
                  <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-11 w-11 shrink-0 rounded-full border-2 border-[#cc0000] bg-gradient-to-br from-[#cc0000] to-red-950 flex items-center justify-center font-heading text-sm font-bold text-white">
                        {emp.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono-tabular text-[10px] font-bold text-amber-300">
                            #{code}
                          </span>
                          <h3 className="font-bold text-sm text-white truncate">
                            {emp.username}
                          </h3>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {emp.designation || 'BIM MODELER'} ·{' '}
                          <span className="text-slate-300 font-semibold">
                            {emp.department || 'MEP-BIM'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <select
                      value={empStatus}
                      onChange={(e) =>
                        handleSaveEmployeeDetails(emp.username, {
                          employmentStatus: e.target.value as EmploymentStatus,
                        })
                      }
                      className={`rounded-lg border px-2 py-1 text-[10px] font-bold uppercase cursor-pointer ${statusBadgeClass(
                        empStatus
                      )}`}
                    >
                      {EMPLOYMENT_STATUSES.map((st) => (
                        <option key={st} value={st} className="bg-slate-900 text-white">
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Key Details Grid */}
                  <div className="grid grid-cols-2 gap-2.5 my-3.5 text-xs">
                    <div className="rounded-xl border border-slate-800/90 bg-[#0b0e14] p-2.5">
                      <span className="text-[10px] uppercase text-slate-400 block">
                        System Role
                      </span>
                      <span className="font-bold text-red-400">{emp.role}</span>
                    </div>

                    <div className="rounded-xl border border-slate-800/90 bg-[#0b0e14] p-2.5">
                      <span className="text-[10px] uppercase text-slate-400 block">
                        Reports To
                      </span>
                      <span className="font-semibold text-white truncate block">
                        {emp.reportsTo || 'Rebecca Mary'}
                      </span>
                    </div>

                    <div className="rounded-xl border border-slate-800/90 bg-[#0b0e14] p-2.5">
                      <span className="text-[10px] uppercase text-slate-400 block">
                        Shift & Sat Off
                      </span>
                      <span className="font-mono-tabular font-semibold text-sky-300">
                        {emp.shiftIn || '9:00 AM'} – {emp.shiftOut || '6:00 PM'} ({emp.workingHours ?? 9}h)
                      </span>
                    </div>

                    <div className="rounded-xl border border-slate-800/90 bg-[#0b0e14] p-2.5">
                      <span className="text-[10px] uppercase text-slate-400 block">
                        Salary & Rate
                      </span>
                      <span className="font-mono-tabular font-bold text-emerald-400">
                        ₹{Number(emp.monthlySalary ?? 23500).toLocaleString('en-IN')} · ₹
                        {Number(emp.hourlySalary ?? 110)}/h
                      </span>
                    </div>

                    <div className="rounded-xl border border-slate-800/90 bg-[#0b0e14] p-2.5">
                      <span className="text-[10px] uppercase text-slate-400 block">
                        Active Screen Time
                      </span>
                      <span className="font-mono-tabular font-bold text-cyan-400">
                        {m.screenHours} hrs
                      </span>
                    </div>

                    <div className="rounded-xl border border-slate-800/90 bg-[#0b0e14] p-2.5">
                      <span className="text-[10px] uppercase text-slate-400 block">
                        Per-Day Assigned Time
                      </span>
                      <span className="font-mono-tabular font-bold text-amber-300">
                        {m.assignedDailyHours > 0
                          ? `${m.assignedDailyHours} hrs/day`
                          : m.poolHoursOwned > 0
                          ? `Pool: ${m.poolHoursOwned} hrs/day`
                          : '8.0 hrs/day (Std)'}
                      </span>
                    </div>
                  </div>

                  {/* Per-Day Assigned Jobs Preview for this Employee */}
                  {m.jobs.length > 0 && (
                    <div className="mb-3 rounded-xl border border-slate-800 bg-[#0b0e14] p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <span>Assigned Work in Time Tracker ({m.jobs.length})</span>
                        {onNavigateToTracker && (
                          <button
                            type="button"
                            onClick={onNavigateToTracker}
                            className="text-sky-400 hover:underline cursor-pointer"
                          >
                            Open Tracker →
                          </button>
                        )}
                      </div>
                      {m.jobs.slice(0, 2).map((j) => (
                        <div
                          key={j.id}
                          className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/90 px-2.5 py-1.5 text-[11px]"
                        >
                          <div className="truncate">
                            <span className="font-bold text-emerald-400">{j.project}</span> ·{' '}
                            <span className="text-slate-200">{j.task}</span> /{' '}
                            <span className="text-sky-300">{j.subtask}</span>
                          </div>
                          <span className="shrink-0 rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 font-mono-tabular text-[10px] font-bold text-amber-300">
                            {j.allocatedHours ?? 8}h/day
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => openEditEmployeeModal(emp)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25 px-3 py-2 text-xs font-bold text-sky-300 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> View / Edit Details
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAssignModalEmp(emp);
                      setQuickStage(
                        emp.role === 'Main Handover' ? 'handover_pool' : 'split_member'
                      );
                      setQuickHours(emp.role === 'Main Handover' ? '24' : '8');
                    }}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 px-3 py-2 text-xs font-bold text-amber-300 cursor-pointer"
                    title="Assign or Split Per-Day Work Time for Time Tracker"
                  >
                    <Clock className="w-3.5 h-3.5" /> Assign Time
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRemoveEmployee(emp.username)}
                    className="inline-flex items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 p-2 text-red-300 cursor-pointer"
                    title="Remove Employee"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =====================================================================
          MODE B: EDITABLE MASTER DIRECTORY TABLE VIEW
      ===================================================================== */}
      {viewMode === 'table' && (
        <div
          className={`rounded-2xl border p-5 shadow-xl ${
            darkMode ? 'border-slate-800 bg-[#121620]' : 'border-slate-200 bg-white'
          }`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#1b365d] text-white font-heading text-[10px] uppercase tracking-wider">
                  <th className="py-2.5 px-2.5 border border-slate-700">Emp ID</th>
                  <th className="py-2.5 px-2.5 border border-slate-700">Employee Name</th>
                  <th className="py-2.5 px-2.5 border border-slate-700">Role</th>
                  <th className="py-2.5 px-2.5 border border-slate-700">Department</th>
                  <th className="py-2.5 px-2.5 border border-slate-700">Designation</th>
                  <th className="py-2.5 px-2.5 border border-slate-700">Shift In</th>
                  <th className="py-2.5 px-2.5 border border-slate-700 text-center">Work Hrs</th>
                  <th className="py-2.5 px-2.5 border border-slate-700">Shift Out</th>
                  <th className="py-2.5 px-2.5 border border-slate-700 text-center">All Sat Off?</th>
                  <th className="py-2.5 px-2.5 border border-slate-700 text-right">Monthly Salary (₹)</th>
                  <th className="py-2.5 px-2.5 border border-slate-700 text-right">Hourly (₹/h)</th>
                  <th className="py-2.5 px-2.5 border border-slate-700 text-center">Screen Time (h)</th>
                  <th className="py-2.5 px-2.5 border border-slate-700">Reports To</th>
                  <th className="py-2.5 px-2.5 border border-slate-700">Status</th>
                  <th className="py-2.5 px-2.5 border border-slate-700 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredEmployees.map((emp, idx) => (
                  <tr key={emp.username} className="hover:bg-slate-800/35">
                    <td className="py-1.5 px-2 border border-slate-800">
                      <input
                        type="text"
                        defaultValue={emp.empCode || String(1001 + idx)}
                        onBlur={(e) =>
                          handleSaveEmployeeDetails(emp.username, { empCode: e.target.value })
                        }
                        className="w-16 rounded border border-slate-700 bg-[#0b0e14] px-2 py-1 font-mono-tabular text-xs font-bold text-amber-300"
                      />
                    </td>
                    <td className="py-1.5 px-2.5 border border-slate-800 font-bold text-white whitespace-nowrap">
                      {emp.username}
                    </td>
                    <td className="py-1.5 px-2 border border-slate-800">
                      <select
                        value={emp.role}
                        onChange={(e) =>
                          handleSaveEmployeeDetails(emp.username, { role: e.target.value })
                        }
                        className="rounded border border-slate-700 bg-[#0b0e14] px-2 py-1 text-xs text-white"
                      >
                        {ALL_USER_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 px-2 border border-slate-800">
                      <input
                        type="text"
                        defaultValue={emp.department || 'MEP-BIM'}
                        onBlur={(e) =>
                          handleSaveEmployeeDetails(emp.username, { department: e.target.value })
                        }
                        className="w-36 rounded border border-slate-700 bg-[#0b0e14] px-2 py-1 text-xs text-slate-200"
                      />
                    </td>
                    <td className="py-1.5 px-2 border border-slate-800">
                      <input
                        type="text"
                        defaultValue={emp.designation || 'BIM MODELER'}
                        onBlur={(e) =>
                          handleSaveEmployeeDetails(emp.username, { designation: e.target.value })
                        }
                        className="w-44 rounded border border-slate-700 bg-[#0b0e14] px-2 py-1 text-xs text-slate-200"
                      />
                    </td>
                    <td className="py-1.5 px-2 border border-slate-800">
                      <input
                        type="text"
                        defaultValue={emp.shiftIn || '9:00 AM'}
                        onBlur={(e) =>
                          handleSaveEmployeeDetails(emp.username, { shiftIn: e.target.value })
                        }
                        className="w-20 rounded border border-blue-500/40 bg-blue-500/10 px-2 py-1 font-mono-tabular text-xs font-bold text-blue-300 text-center"
                      />
                    </td>
                    <td className="py-1.5 px-2 border border-slate-800 text-center">
                      <input
                        type="number"
                        defaultValue={emp.workingHours ?? 9}
                        onBlur={(e) =>
                          handleSaveEmployeeDetails(emp.username, {
                            workingHours: Number(e.target.value) || 9,
                          })
                        }
                        className="w-14 rounded border border-blue-500/40 bg-blue-500/10 px-1.5 py-1 font-mono-tabular text-xs font-bold text-blue-300 text-center"
                      />
                    </td>
                    <td className="py-1.5 px-2 border border-slate-800">
                      <input
                        type="text"
                        defaultValue={emp.shiftOut || '6:00 PM'}
                        onBlur={(e) =>
                          handleSaveEmployeeDetails(emp.username, { shiftOut: e.target.value })
                        }
                        className="w-20 rounded border border-slate-700 bg-[#0b0e14] px-2 py-1 font-mono-tabular text-xs text-slate-200 text-center"
                      />
                    </td>
                    <td className="py-1.5 px-2 border border-slate-800 text-center">
                      <select
                        value={emp.allSaturdaysOff ? 'Yes' : 'No'}
                        onChange={(e) =>
                          handleSaveEmployeeDetails(emp.username, {
                            allSaturdaysOff: e.target.value === 'Yes',
                          })
                        }
                        className="rounded border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-xs font-bold text-blue-300"
                      >
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                    </td>
                    <td className="py-1.5 px-2 border border-slate-800 text-right">
                      <input
                        type="number"
                        defaultValue={emp.monthlySalary ?? 23500}
                        onBlur={(e) =>
                          handleSaveEmployeeDetails(emp.username, {
                            monthlySalary: Number(e.target.value) || 0,
                          })
                        }
                        className="w-24 rounded border border-slate-700 bg-[#0b0e14] px-2 py-1 text-right font-mono-tabular text-xs font-bold text-emerald-400"
                      />
                    </td>
                    <td className="py-1.5 px-2 border border-slate-800 text-right">
                      <input
                        type="number"
                        defaultValue={emp.hourlySalary ?? 110}
                        onBlur={(e) =>
                          handleSaveEmployeeDetails(emp.username, {
                            hourlySalary: Number(e.target.value) || 0,
                          })
                        }
                        className="w-16 rounded border border-slate-700 bg-[#0b0e14] px-2 py-1 text-right font-mono-tabular text-xs text-amber-300"
                      />
                    </td>
                    <td className="py-1.5 px-2 border border-slate-800 text-center">
                      <input
                        type="number"
                        step="0.5"
                        defaultValue={emp.screenTimeHours ?? 162}
                        onBlur={(e) =>
                          handleSaveEmployeeDetails(emp.username, {
                            screenTimeHours: Number(e.target.value) || 0,
                          })
                        }
                        className="w-16 rounded border border-cyan-500/40 bg-cyan-500/10 px-1.5 py-1 text-center font-mono-tabular text-xs font-bold text-cyan-300"
                      />
                    </td>
                    <td className="py-1.5 px-2 border border-slate-800">
                      <input
                        type="text"
                        defaultValue={emp.reportsTo || 'SONAIMUTHU V'}
                        onBlur={(e) =>
                          handleSaveEmployeeDetails(emp.username, { reportsTo: e.target.value })
                        }
                        className="w-32 rounded border border-slate-700 bg-[#0b0e14] px-2 py-1 text-xs text-slate-200"
                      />
                    </td>
                    <td className="py-1.5 px-2 border border-slate-800">
                      <select
                        value={(emp.employmentStatus || 'Active') as EmploymentStatus}
                        onChange={(e) =>
                          handleSaveEmployeeDetails(emp.username, {
                            employmentStatus: e.target.value as EmploymentStatus,
                          })
                        }
                        className={`rounded border px-2 py-1 text-[10px] font-bold uppercase ${statusBadgeClass(
                          emp.employmentStatus || 'Active'
                        )}`}
                      >
                        {EMPLOYMENT_STATUSES.map((st) => (
                          <option key={st} value={st} className="bg-slate-900 text-white">
                            {st}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 px-2 border border-slate-800 text-right whitespace-nowrap space-x-1">
                      <button
                        type="button"
                        onClick={() => openEditEmployeeModal(emp)}
                        className="rounded border border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25 px-2 py-1 text-[10px] font-bold text-sky-300 cursor-pointer"
                      >
                        Full Details
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveEmployee(emp.username)}
                        className="rounded border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 px-2 py-1 text-[10px] font-bold text-red-300 cursor-pointer"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 1: FULL EDITABLE EMPLOYEE DETAILS MODAL
      ===================================================================== */}
      {selectedEmp && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-[#121620] p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="rounded bg-[#cc0000]/20 border border-[#cc0000]/40 px-2 py-0.5 font-mono-tabular text-[10px] font-bold uppercase text-red-300">
                  EDITABLE EMPLOYEE RECORD · #{editDraft.empCode || selectedEmp.empCode || '1001'}
                </span>
                <h3 className="font-heading text-lg font-bold uppercase tracking-wider text-white mt-1">
                  {selectedEmp.username} — Complete Employee Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmp(null)}
                className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs max-h-[68vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Employee Code / ID
                </label>
                <input
                  type="text"
                  value={editDraft.empCode || ''}
                  onChange={(e) => setEditDraft({ ...editDraft, empCode: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 font-mono-tabular text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  System Access Role
                </label>
                <select
                  value={editDraft.role || 'Production'}
                  onChange={(e) => setEditDraft({ ...editDraft, role: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                >
                  {ALL_USER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Employment Status
                </label>
                <select
                  value={(editDraft.employmentStatus || 'Active') as EmploymentStatus}
                  onChange={(e) =>
                    setEditDraft({
                      ...editDraft,
                      employmentStatus: e.target.value as EmploymentStatus,
                    })
                  }
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                >
                  {EMPLOYMENT_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Designation
                </label>
                <input
                  type="text"
                  value={editDraft.designation || ''}
                  onChange={(e) => setEditDraft({ ...editDraft, designation: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  value={editDraft.department || ''}
                  onChange={(e) => setEditDraft({ ...editDraft, department: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Reports To (Manager / Handover)
                </label>
                <input
                  type="text"
                  value={editDraft.reportsTo || ''}
                  onChange={(e) => setEditDraft({ ...editDraft, reportsTo: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Shift In Time
                </label>
                <input
                  type="text"
                  value={editDraft.shiftIn || '9:00 AM'}
                  onChange={(e) => setEditDraft({ ...editDraft, shiftIn: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 font-mono-tabular text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Working Hours / Day
                </label>
                <input
                  type="number"
                  value={editDraft.workingHours ?? 9}
                  onChange={(e) =>
                    setEditDraft({ ...editDraft, workingHours: Number(e.target.value) || 9 })
                  }
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 font-mono-tabular text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Shift Out Time
                </label>
                <input
                  type="text"
                  value={editDraft.shiftOut || '6:00 PM'}
                  onChange={(e) => setEditDraft({ ...editDraft, shiftOut: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 font-mono-tabular text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Monthly Salary (₹)
                </label>
                <input
                  type="number"
                  value={editDraft.monthlySalary ?? 23500}
                  onChange={(e) =>
                    setEditDraft({ ...editDraft, monthlySalary: Number(e.target.value) || 0 })
                  }
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 font-mono-tabular text-emerald-400 font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Hourly Salary Rate (₹/hr)
                </label>
                <input
                  type="number"
                  value={editDraft.hourlySalary ?? 110}
                  onChange={(e) =>
                    setEditDraft({ ...editDraft, hourlySalary: Number(e.target.value) || 0 })
                  }
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 font-mono-tabular text-amber-300 font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Active Screen Time (Hrs)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={editDraft.screenTimeHours ?? 162}
                  onChange={(e) =>
                    setEditDraft({ ...editDraft, screenTimeHours: Number(e.target.value) || 0 })
                  }
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 font-mono-tabular text-cyan-300 font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Lunch Break Window
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="time"
                    value={editDraft.lunchBreakStart || '13:00'}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, lunchBreakStart: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-2 py-2 font-mono-tabular text-white"
                  />
                  <span className="text-slate-500">to</span>
                  <input
                    type="time"
                    value={editDraft.lunchBreakEnd || '13:45'}
                    onChange={(e) => setEditDraft({ ...editDraft, lunchBreakEnd: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-2 py-2 font-mono-tabular text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Tea Break Window
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="time"
                    value={editDraft.teaBreakStart || '17:00'}
                    onChange={(e) => setEditDraft({ ...editDraft, teaBreakStart: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-2 py-2 font-mono-tabular text-white"
                  />
                  <span className="text-slate-500">to</span>
                  <input
                    type="time"
                    value={editDraft.teaBreakEnd || '17:15'}
                    onChange={(e) => setEditDraft({ ...editDraft, teaBreakEnd: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-2 py-2 font-mono-tabular text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  All Saturdays Off?
                </label>
                <select
                  value={editDraft.allSaturdaysOff ? 'Yes' : 'No'}
                  onChange={(e) =>
                    setEditDraft({ ...editDraft, allSaturdaysOff: e.target.value === 'Yes' })
                  }
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                >
                  <option value="No">No (2nd & 4th Saturday Off)</option>
                  <option value="Yes">Yes (Every Saturday Off)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Work Location
                </label>
                <input
                  type="text"
                  value={editDraft.workLocation || 'BIM BYTES SOLUTIONS'}
                  onChange={(e) => setEditDraft({ ...editDraft, workLocation: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={editDraft.bankName || '-'}
                  onChange={(e) => setEditDraft({ ...editDraft, bankName: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Bank Account No.
                </label>
                <input
                  type="text"
                  value={editDraft.bankAccountNo || '-'}
                  onChange={(e) => setEditDraft({ ...editDraft, bankAccountNo: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 font-mono-tabular text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  IFSC Code
                </label>
                <input
                  type="text"
                  value={editDraft.ifscCode || '-'}
                  onChange={(e) => setEditDraft({ ...editDraft, ifscCode: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 font-mono-tabular text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Branch Name
                </label>
                <input
                  type="text"
                  value={editDraft.branchName || '-'}
                  onChange={(e) => setEditDraft({ ...editDraft, branchName: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  UAN Number
                </label>
                <input
                  type="text"
                  value={editDraft.uanNumber || '-'}
                  onChange={(e) => setEditDraft({ ...editDraft, uanNumber: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 font-mono-tabular text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  PF Number
                </label>
                <input
                  type="text"
                  value={editDraft.pfNumber || '-'}
                  onChange={(e) => setEditDraft({ ...editDraft, pfNumber: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 font-mono-tabular text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  ESIC Number
                </label>
                <input
                  type="text"
                  value={editDraft.esicNumber || '-'}
                  onChange={(e) => setEditDraft({ ...editDraft, esicNumber: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 font-mono-tabular text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Emergency Contact
                </label>
                <input
                  type="text"
                  value={editDraft.emergencyContact || ''}
                  onChange={(e) =>
                    setEditDraft({ ...editDraft, emergencyContact: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 font-mono-tabular text-white"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2">
                {onNavigateToPayroll && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEmp(null);
                      onNavigateToPayroll();
                    }}
                    className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 px-3 py-2 text-xs font-bold text-emerald-300 cursor-pointer"
                  >
                    Open in Salary & Payslip →
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedEmp(null)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingEmp}
                  onClick={() =>
                    handleSaveEmployeeDetails(selectedEmp.username, editDraft, true)
                  }
                  className="rounded-xl bg-[#cc0000] hover:bg-red-700 px-5 py-2 font-heading text-xs font-bold uppercase tracking-wider text-white shadow-lg cursor-pointer disabled:opacity-50"
                >
                  {savingEmp ? 'Saving...' : 'Save All Employee Details'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: QUICK PER-DAY WORK TIME ASSIGN / SPLIT MODAL
      ===================================================================== */}
      {assignModalEmp && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-[#121620] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="rounded bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 font-mono-tabular text-[10px] font-bold uppercase text-amber-300">
                  PER-DAY TIME TRACKER ASSIGNMENT
                </span>
                <h3 className="font-heading text-base font-bold uppercase tracking-wider text-white mt-1">
                  Assign / Split Daily Work Time for {assignModalEmp.username}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalEmp(null)}
                className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAssignWorkTime} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Assignment Type
                </label>
                <select
                  value={quickStage}
                  onChange={(e) => setQuickStage(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                >
                  <option value="handover_pool">
                    Coordinator / Manager / Founder / HR → Assign Daily Time Pool to Main Handover
                  </option>
                  <option value="split_member">
                    Main Handover → Split Daily Time to Employee (Falls into Time Tracker)
                  </option>
                  <option value="direct">
                    Direct Daily Job & Time Assignment (Falls into Time Tracker)
                  </option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Fixed Project
                  </label>
                  <select
                    value={quickProject}
                    onChange={(e) => setQuickProject(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                  >
                    {PROJECTS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Fixed Task
                  </label>
                  <select
                    value={quickTask}
                    onChange={(e) => setQuickTask(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                  >
                    {TASKS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Fixed Subtask
                  </label>
                  <select
                    value={quickSubtask}
                    onChange={(e) => setQuickSubtask(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                  >
                    {SUBTASKS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-amber-300 mb-1">
                    Allocated Time (Hours / Day)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="48"
                    value={quickHours}
                    onChange={(e) => setQuickHours(e.target.value)}
                    className="w-full rounded-xl border border-amber-500/40 bg-[#0b0e14] px-3 py-2 font-mono-tabular font-bold text-amber-300"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Priority
                  </label>
                  <select
                    value={quickPriority}
                    onChange={(e) => setQuickPriority(e.target.value as PriorityLevel)}
                    className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                  >
                    {PRIORITY_LEVELS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Handover Instructions / Notes
                </label>
                <input
                  type="text"
                  value={quickNotes}
                  onChange={(e) => setQuickNotes(e.target.value)}
                  placeholder="e.g., Split from 24h CMRL HVAC Pool for today..."
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignModalEmp(null)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#cc0000] hover:bg-red-700 px-5 py-2 font-heading text-xs font-bold uppercase tracking-wider text-white shadow-lg cursor-pointer"
                >
                  Assign to Time Tracker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: ADD NEW EMPLOYEE MODAL
      ===================================================================== */}
      {addModalOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-[#121620] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-heading text-base font-bold uppercase tracking-wider text-white">
                Add New Employee to BIM Bytes Roster
              </h3>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleAddNewEmployee}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs"
            >
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Employee Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  placeholder="e.g., VIGNESH KUMAR S"
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Emp Code / ID
                </label>
                <input
                  type="text"
                  value={newEmpCode}
                  onChange={(e) => setNewEmpCode(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 font-mono-tabular text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  System Role
                </label>
                <select
                  value={newEmpRole}
                  onChange={(e) => setNewEmpRole(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                >
                  {ALL_USER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  value={newEmpDept}
                  onChange={(e) => setNewEmpDept(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Designation
                </label>
                <input
                  type="text"
                  value={newEmpDesig}
                  onChange={(e) => setNewEmpDesig(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Reports To
                </label>
                <input
                  type="text"
                  value={newEmpReportsTo}
                  onChange={(e) => setNewEmpReportsTo(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Shift In
                </label>
                <input
                  type="text"
                  value={newEmpShiftIn}
                  onChange={(e) => setNewEmpShiftIn(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 font-mono-tabular text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Working Hours
                </label>
                <input
                  type="number"
                  value={newEmpWorkHrs}
                  onChange={(e) => setNewEmpWorkHrs(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 font-mono-tabular text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Shift Out
                </label>
                <input
                  type="text"
                  value={newEmpShiftOut}
                  onChange={(e) => setNewEmpShiftOut(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 font-mono-tabular text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Monthly Salary (₹)
                </label>
                <input
                  type="number"
                  value={newEmpMonthlySal}
                  onChange={(e) => setNewEmpMonthlySal(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 font-mono-tabular text-emerald-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Hourly Rate (₹/hr)
                </label>
                <input
                  type="number"
                  value={newEmpHourlySal}
                  onChange={(e) => setNewEmpHourlySal(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 font-mono-tabular text-amber-300"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Employment Status
                </label>
                <select
                  value={newEmpStatus}
                  onChange={(e) => setNewEmpStatus(e.target.value as EmploymentStatus)}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                >
                  {EMPLOYMENT_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={newEmpBankName}
                  onChange={(e) => setNewEmpBankName(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Bank Account No.
                </label>
                <input
                  type="text"
                  value={newEmpBankAcc}
                  onChange={(e) => setNewEmpBankAcc(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 font-mono-tabular text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  IFSC Code
                </label>
                <input
                  type="text"
                  value={newEmpIfsc}
                  onChange={(e) => setNewEmpIfsc(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 font-mono-tabular text-white"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3 flex items-center justify-between pt-3 border-t border-slate-800">
                <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newEmpAllSatOff}
                    onChange={(e) => setNewEmpAllSatOff(e.target.checked)}
                    className="rounded border-slate-600"
                  />
                  All Saturdays Off?
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAddModalOpen(false)}
                    className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2 font-heading text-xs font-bold uppercase tracking-wider text-white shadow cursor-pointer"
                  >
                    Save Employee
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
