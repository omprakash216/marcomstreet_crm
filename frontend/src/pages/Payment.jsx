import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FiArrowLeft,
  FiCheckCircle,
  FiCreditCard,
  FiGlobe,
  FiInfo,
  FiLoader,
  FiShield,
  FiSmartphone,
} from 'react-icons/fi';
import api from '../utils/api';

const PAYMENT_METHODS = [
  { id: 'upi_phonepe', label: 'UPI - PhonePe', mode: 'upi', description: 'Pay using PhonePe UPI.' },
  { id: 'upi_gpay', label: 'UPI - Google Pay', mode: 'upi', description: 'Pay using Google Pay UPI.' },
  { id: 'upi_paytm', label: 'UPI - Paytm', mode: 'upi', description: 'Pay using Paytm UPI.' },
  { id: 'card', label: 'Credit Card', mode: 'card', description: 'Visa, Mastercard, Amex.' },
  { id: 'debit_card', label: 'Debit Card', mode: 'card', description: 'Savings or current account card.' },
  { id: 'netbanking', label: 'Netbanking', mode: 'bank', description: 'Use your bank portal to pay.' },
];

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Custom';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function getMethodMeta(methodId) {
  return PAYMENT_METHODS.find((method) => method.id === methodId) || PAYMENT_METHODS[0];
}

export default function Payment() {
  const query = useQuery();
  const navigate = useNavigate();
  const sessionId = query.get('session') || '';

  const [loading, setLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionInfo, setSessionInfo] = useState(null);
  const [method, setMethod] = useState('upi_phonepe');
  const [form, setForm] = useState({
    upiId: '',
    upiReference: '',
    cardNumber: '',
    expiry: '',
    cvv: '',
    cardholderName: '',
    bankName: '',
    accountHolderName: '',
    bankReference: '',
  });

  const methodMeta = getMethodMeta(method);
  const isUpi = methodMeta.mode === 'upi';
  const isCard = methodMeta.mode === 'card';
  const isBank = methodMeta.mode === 'bank';

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      if (!sessionId) {
        setError('Invalid payment session.');
        setSessionLoading(false);
        return;
      }

      setSessionLoading(true);
      setError('');
      try {
        const response = await api.get(`/billing/session/${encodeURIComponent(sessionId)}`);
        if (!cancelled) {
          setSessionInfo(response.data?.data || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || err.message || 'Unable to load payment session.');
        }
      } finally {
        if (!cancelled) {
          setSessionLoading(false);
        }
      }
    };

    loadSession();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    setForm((current) => {
      if (isUpi) {
        return {
          ...current,
          cardNumber: '',
          expiry: '',
          cvv: '',
          cardholderName: '',
          bankName: '',
          accountHolderName: '',
          bankReference: '',
        };
      }

      if (isCard) {
        return {
          ...current,
          upiId: '',
          upiReference: '',
          bankName: '',
          accountHolderName: '',
          bankReference: '',
        };
      }

      return {
        ...current,
        upiId: '',
        upiReference: '',
        cardNumber: '',
        expiry: '',
        cvv: '',
        cardholderName: '',
      };
    });
  }, [isBank, isCard, isUpi]);

  const handlePay = async (e) => {
    e.preventDefault();

    if (!sessionId) {
      setError('Invalid payment session.');
      return;
    }

    if (!sessionInfo) {
      setError('Payment session could not be loaded. Please refresh and try again.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const paymentDetails = isUpi
        ? {
            method_group: 'upi',
            upi_id: form.upiId.trim() || null,
            reference_id: form.upiReference.trim() || null,
          }
        : isCard
          ? {
              method_group: 'card',
              cardholder_name: form.cardholderName.trim() || null,
              card_last4: String(form.cardNumber || '').replace(/\D/g, '').slice(-4) || null,
              expiry: form.expiry.trim() || null,
            }
          : {
              method_group: 'netbanking',
              bank_name: form.bankName.trim() || null,
              account_holder_name: form.accountHolderName.trim() || null,
              reference_id: form.bankReference.trim() || null,
            };

      const resp = await api.post('/billing/confirm', {
        sessionId,
        paymentMethod: method,
        paymentDetails,
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

  const buttonLabel = isUpi
    ? `Confirm ${methodMeta.label}`
    : isCard
      ? 'Pay now'
      : 'Confirm bank transfer';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ffffff_0%,_#f6f8ff_35%,_#eef2ff_100%)] text-slate-900 px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <aside className="rounded-[32px] border border-slate-200 bg-white/90 p-8 shadow-[0_28px_80px_rgba(15,23,42,0.12)] backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600">
                <FiShield />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Payment</p>
                <h1 className="text-2xl font-bold text-slate-900">Complete your payment</h1>
              </div>
            </div>

            <p className="mt-5 text-sm leading-7 text-slate-600">
              Select a payment method and finish the checkout. UPI will not ask for card details. Card fields
              only appear when you choose a card method.
            </p>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <FiInfo className="mt-0.5 shrink-0 text-blue-600" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">Demo checkout flow</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    This local checkout marks the subscription as paid after method confirmation, so your
                    login activation flow can continue without a real gateway.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <FiCheckCircle className="text-emerald-600" />
                Session summary
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                {sessionLoading ? (
                  <div className="flex items-center gap-2 text-slate-500">
                    <FiLoader className="animate-spin" />
                    Loading session...
                  </div>
                ) : sessionInfo ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-semibold text-slate-500">Plan</span>
                      <strong className="text-slate-900">{sessionInfo.plan_label || sessionInfo.plan}</strong>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-semibold text-slate-500">Amount</span>
                      <strong className="text-slate-900">{formatMoney(sessionInfo.amount)}</strong>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-semibold text-slate-500">Email</span>
                      <strong className="truncate text-slate-900">{sessionInfo.email}</strong>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-semibold text-slate-500">Status</span>
                      <strong className="text-slate-900">{String(sessionInfo.status || '').toUpperCase()}</strong>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500">Session details unavailable.</p>
                )}
              </div>
            </div>

            <div className="mt-6 space-y-2 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <FiSmartphone className="text-blue-600" />
                UPI methods skip card number, expiry, and CVV fields.
              </div>
              <div className="flex items-center gap-2">
                <FiCreditCard className="text-blue-600" />
                Card fields appear only for card methods.
              </div>
              <div className="flex items-center gap-2">
                <FiGlobe className="text-blue-600" />
                Netbanking shows bank details instead of card inputs.
              </div>
            </div>

            <div className="mt-8">
              <Link to="/crm" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-500">
                <FiArrowLeft />
                Back to home
              </Link>
            </div>
          </aside>

          <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_28px_80px_rgba(15,23,42,0.12)]">
            {error ? (
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <form className="space-y-6" onSubmit={handlePay}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Payment method</p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {PAYMENT_METHODS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setMethod(option.id)}
                      className={`rounded-2xl border px-4 py-3 text-left transition ${
                        method === option.id
                          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block text-sm font-semibold">{option.label}</span>
                      <span className="mt-1 block text-xs text-slate-500">{option.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {isUpi ? (
                <div className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 md:grid-cols-2">
                  <div className="md:col-span-2 rounded-2xl border border-blue-100 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900">UPI payment</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Open your UPI app, complete the payment, and then confirm it here. No card number is needed.
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      UPI ID
                    </label>
                    <input
                      value={form.upiId}
                      onChange={(e) => setForm((current) => ({ ...current, upiId: e.target.value }))}
                      placeholder="name@bank"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      UTR / Reference ID
                    </label>
                    <input
                      value={form.upiReference}
                      onChange={(e) => setForm((current) => ({ ...current, upiReference: e.target.value }))}
                      placeholder="Optional"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              ) : null}

              {isCard ? (
                <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="rounded-2xl border border-blue-100 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900">Card payment</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Fill only the card details for card payments. These fields stay hidden for UPI and bank transfer.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Card Number
                      </label>
                      <input
                        value={form.cardNumber}
                        onChange={(e) =>
                          setForm((current) => ({
                            ...current,
                            cardNumber: e.target.value.replace(/[^\d\s]/g, ''),
                          }))
                        }
                        inputMode="numeric"
                        placeholder="1234 5678 9012 3456"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required={isCard}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Expiry
                      </label>
                      <input
                        value={form.expiry}
                        onChange={(e) => setForm((current) => ({ ...current, expiry: e.target.value }))}
                        placeholder="MM/YY"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required={isCard}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        CVV
                      </label>
                      <input
                        value={form.cvv}
                        onChange={(e) => setForm((current) => ({ ...current, cvv: e.target.value.replace(/\D/g, '') }))}
                        inputMode="numeric"
                        placeholder="123"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required={isCard}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Cardholder Name
                      </label>
                      <input
                        value={form.cardholderName}
                        onChange={(e) => setForm((current) => ({ ...current, cardholderName: e.target.value }))}
                        placeholder="Name on card"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required={isCard}
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {isBank ? (
                <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="rounded-2xl border border-blue-100 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900">Netbanking</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Use this section for bank transfers. No card fields are needed here.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Bank Name
                      </label>
                      <input
                        value={form.bankName}
                        onChange={(e) => setForm((current) => ({ ...current, bankName: e.target.value }))}
                        placeholder="Your bank"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Account Holder
                      </label>
                      <input
                        value={form.accountHolderName}
                        onChange={(e) => setForm((current) => ({ ...current, accountHolderName: e.target.value }))}
                        placeholder="Account holder name"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Bank Reference / UTR
                      </label>
                      <input
                        value={form.bankReference}
                        onChange={(e) => setForm((current) => ({ ...current, bankReference: e.target.value }))}
                        placeholder="Optional"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading || sessionLoading || !sessionInfo}
                className="mt-2 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Processing payment...' : buttonLabel}
              </button>

              <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4 text-xs text-slate-500">
                <span>Session: {sessionId ? `${sessionId.slice(0, 10)}...` : '-'}</span>
                <span>{sessionInfo?.plan_label ? `Plan: ${sessionInfo.plan_label}` : 'Subscription checkout'}</span>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
