import { Link } from 'react-router-dom';

export default function SetupPlaceholderPage({ title, description }) {
  return (
    <div className="space-y-5">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <p className="text-[11px] uppercase tracking-widest text-[#2c86ab] font-bold">Super Admin Setup Panel</p>
        <h1 className="text-2xl font-black text-gray-900 mt-1">{title}</h1>
        <p className="text-sm text-gray-600 mt-2 max-w-3xl">{description}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/superadmin/setup" className="bg-white border border-gray-200 rounded-xl p-4 hover:bg-blue-50/40">
          <p className="font-bold text-gray-900">Back to Setup Dashboard</p>
          <p className="text-xs text-gray-500 mt-1">Open main setup overview</p>
        </Link>
        <Link to="/superadmin/companies" className="bg-white border border-gray-200 rounded-xl p-4 hover:bg-blue-50/40">
          <p className="font-bold text-gray-900">Open Companies</p>
          <p className="text-xs text-gray-500 mt-1">Manage company records and status</p>
        </Link>
      </div>
    </div>
  );
}

