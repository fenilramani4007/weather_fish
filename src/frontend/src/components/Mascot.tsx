import React from 'react';

type MascotType = 'mascotfish' | 'mascotmerkel' | 'mascothaftbefehl';

interface MascotProps {
    activeMascot: MascotType;
}

const MASCOT_URLS: Record<MascotType, string> = {
    mascotfish:       '/mascots/fishmascot.png',
    mascotmerkel:     '/mascots/fishmascotmerkel.png',
    mascothaftbefehl: '/mascots/fishmascothaftbefehl.png',
};

const Mascot: React.FC<MascotProps> = ({ activeMascot }) => {
    const containerStyle: React.CSSProperties = {
        width: '280px',
        height: '280px',
        position: 'relative',
        overflow: 'hidden'
    };

    const imageStyle: React.CSSProperties = {
        width: '100%',
        height: '100%',
        position: 'relative',
        top: '-10px',
        left: '0',
        objectFit: 'contain',
        transition: 'opacity 0.3s ease-in-out'
    };

    return (
        <div style={containerStyle}>
            <img
                key={activeMascot}
                src={MASCOT_URLS[activeMascot] ?? MASCOT_URLS.mascotfish}
                alt={activeMascot}
                style={imageStyle}
            />
        </div>
    );
};

export default Mascot;
