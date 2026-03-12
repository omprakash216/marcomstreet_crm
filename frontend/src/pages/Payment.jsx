import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../utils/api';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function Payment() {
  const query = useQuery();
  const navigate = useNavigate();
  const sessionId = query.get('session') || '';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [method, setMethod] = useState('card');

  const handlePay = async (e) => {
    e.preventDefault();
    if (!sessionId) {
      setError('Invalid payment session.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const resp = await api.post('/billing/confirm', {
        sessionId,
        paymentMethod: method,
      });
      const email = resp.data?.data?.email;
      if (!email) throw new Error(resp.data?.message || 'Payment confirmation failed');

      navigate(`/set-password?session=${encodeURIComponent(sessionId)}&email=${encodeURIComponent(email)}`, {
        replace: true,
      });
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl rounded-3xl bg-white border border-slate-200 shadow-2xl p-8 md:p-10 space-y-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Payment</p>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Complete your payment</h1>
          <p className="text-sm text-slate-600">
            Select a payment method and complete your payment. After that you can set your own password to log in.
          </p>
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={handlePay}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 mb-2">Payment method</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              {[
                { id: 'upi_phonepe', label: 'UPI – PhonePe' },
                { id: 'upi_gpay', label: 'UPI – Google Pay' },
                { id: 'upi_paytm', label: 'UPI – Paytm' },
                { id: 'card', label: 'Credit Card' },
                { id: 'debit_card', label: 'Debit Card' },
                { id: 'netbanking', label: 'Netbanking' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMethod(opt.id)}
                  className={`rounded-full border px-3 py-2 text-left ${
                    method === opt.id
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Card Number</label>
              <input
                inputMode="numeric"
                placeholder="1234 5678 9012 3456"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Expiry</label>
                <input
                  placeholder="MM/YY"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">CVV</label>
                <input
                  inputMode="numeric"
                  placeholder="123"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Cardholder Name</label>
            <input
              placeholder="Name on card"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition disabled:opacity-60"
          >
            {loading ? 'Processing payment…' : 'Pay now'}
          </button>

          <div className="text-xs text-slate-500 flex items-center justify-between pt-2">
            <span>Session: {sessionId ? sessionId.slice(0, 10) + '…' : '—'}</span>
            <Link to="/" className="text-blue-600 hover:text-blue-500 font-semibold">
              Back to home
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

