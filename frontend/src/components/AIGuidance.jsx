import { useState, useEffect } from 'react';
import api from '../utils/api';

export default function AIGuidance({ leadId, onClose }) {
  const [guidance, setGuidance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (leadId) {
      fetchGuidance();
    }
  }, [leadId]);

  const fetchGuidance = async () => {
    try {
      const response = await api.get(`/ai/guidance?lead_id=${leadId}`);
      setGuidance(response.data.data);
    } catch (error) {
      console.error('Error fetching AI guidance:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!leadId) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">AI Guidance & Recommendations</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading recommendations...</div>
        ) : guidance ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Lead Score</div>
                <div className="text-2xl font-bold text-blue-600">{guidance.lead_score}</div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${guidance.lead_score}%` }}
                  />
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Deal Probability</div>
                <div className="text-2xl font-bold text-green-600">{guidance.deal_probability}%</div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${guidance.deal_probability}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Best Follow-up Time</div>
              <div className="text-lg font-medium text-purple-700">{guidance.best_followup_time}</div>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Best Communication Channel</div>
              <div className="text-lg font-medium text-orange-700 capitalize">{guidance.best_communication_channel}</div>
            </div>

            {guidance.recommendations && guidance.recommendations.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Recommendations:</div>
                <ul className="list-disc list-inside space-y-1">
                  {guidance.recommendations.map((rec, index) => (
                    <li key={index} className="text-sm text-gray-700">{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">No guidance available</div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

