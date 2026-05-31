import { Link } from "react-router-dom";

const defaultActions = [
  { label: "Go to Dashboard", to: "/admin" },
  { label: "Open Reports", to: "/admin/reports" },
];

export default function AdminFeaturePage({
  title,
  description,
  actionLinks = defaultActions,
}) {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-[#2c86ab] font-bold">
              Company Admin Panel
            </p>
            <h1 className="text-2xl font-black text-gray-900 mt-1">{title}</h1>
            <p className="text-sm text-gray-600 mt-2 max-w-3xl">{description}</p>
          </div>
          <span className="hidden sm:inline-flex px-3 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
            ACTIVE MODULE
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actionLinks.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-200 hover:bg-blue-50/40 transition-colors"
          >
            <p className="text-sm font-bold text-gray-900">{item.label}</p>
            <p className="text-xs text-gray-500 mt-1">{item.to}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
