import React from 'react';
import logoImage from '../assets/vg.png';

const MarcomLogo = ({ className = '' }) => {
    return (
        <div className={`flex items-center justify-center ${className}`}>
            <img
                src={logoImage}
                alt="Marcom Logo"
                className="object-contain"
                style={{ width: '100%', height: '100%' }}
            />
        </div>
    );
};

export default MarcomLogo;
