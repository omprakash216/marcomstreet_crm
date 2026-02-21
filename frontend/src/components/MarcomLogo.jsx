import React from 'react';
import logoImage from '../assets/MS_LOGO2.png';

const MarcomLogo = ({ className = '' }) => {
    return (
        <div className={`flex items-center justify-center ${className}`}>
            <img
                src={logoImage}
                alt="Marcom Logo"
                className="w-full h-full object-contain"
            />
        </div>
    );
};

export default MarcomLogo;
