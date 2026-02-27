
import React from 'react';
import InspectorContainer from './inspector/InspectorContainer';

/**
 * SystemDataInspector (Hidden/Admin Interface)
 * 
 * This is the entry point for the system data analysis tool.
 * The implementation has been refactored into a modular structure under ./inspector/
 */
const SystemDataInspector: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    return <InspectorContainer onClose={onClose} />;
};

export default SystemDataInspector;
