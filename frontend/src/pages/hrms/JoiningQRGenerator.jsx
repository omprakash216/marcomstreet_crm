import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import QRCode from 'qrcode.react';

const JoiningQRGenerator = () => {
    const [qrData, setQrData] = useState(null);
    const [loading, setLoading] = useState(false);

    const generateQR = async () => {
        setLoading(true);
        try {
            const response = await api.post('/hrms/generate_qr');
            if (response.data.success) {
                setQrData(response.data);
            } else {
                alert(response.data.message || 'Failed to generate QR code');
            }
        } catch (error) {
            console.error('Error generating QR:', error);
            alert('Failed to generate QR code');
        } finally {
            setLoading(false);
        }
    };

    const downloadQR = () => {
        const canvas = document.getElementById('qr-code');
        const pngUrl = canvas
            .toDataURL('image/png')
            .replace('image/png', 'image/octet-stream');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = `joining-form-qr-${qrData.token.substring(0, 8)}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    };

    return (
        <div className="p-6">
            <div className="bg-gradient-to-r from-blue-800 via-blue-900 to-gray-900 rounded-xl shadow-lg mb-6 p-6">
                <h1 className="text-3xl font-bold text-white mb-1">Generate Joining Form QR Code</h1>
                <p className="text-blue-200 text-sm">Create scannable QR codes for candidates to fill joining forms</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                {!qrData ? (
                    <div className="text-center">
                        <div className="mb-6">
                            <i className="fas fa-qrcode text-6xl text-blue-600 mb-4"></i>
                            <h2 className="text-2xl font-bold mb-2">Generate New QR Code</h2>
                            <p className="text-gray-600">
                                Click the button below to generate a unique QR code for the joining form
                            </p>
                        </div>
                        <button
                            onClick={generateQR}
                            disabled={loading}
                            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400"
                        >
                            {loading ? 'Generating...' : 'Generate QR Code'}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h3 className="text-xl font-bold mb-4">QR Code Generated Successfully!</h3>
                            <div className="inline-block p-6 bg-white border-4 border-blue-600 rounded-lg">
                                <QRCode
                                    id="qr-code"
                                    value={qrData.url}
                                    size={256}
                                    level="H"
                                    includeMargin={true}
                                />
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h4 className="font-semibold mb-2">Shareable Link:</h4>
                            <div className="flex items-center space-x-2">
                                <input
                                    type="text"
                                    value={qrData.url}
                                    readOnly
                                    className="flex-1 px-3 py-2 border rounded bg-white"
                                />
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(qrData.url);
                                        alert('Link copied to clipboard!');
                                    }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                    Copy
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-center space-x-4">
                            <button
                                onClick={downloadQR}
                                className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
                            >
                                <i className="fas fa-download mr-2"></i>
                                Download QR Code
                            </button>
                            <button
                                onClick={() => setQrData(null)}
                                className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700"
                            >
                                Generate Another
                            </button>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h4 className="font-semibold text-blue-900 mb-2">Instructions:</h4>
                            <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
                                <li>Download the QR code image or copy the link</li>
                                <li>Share with candidates via email, WhatsApp, or print it</li>
                                <li>Candidates scan the QR code to access the joining form</li>
                                <li>Review submissions in the "Joining Submissions" section</li>
                            </ol>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default JoiningQRGenerator;
