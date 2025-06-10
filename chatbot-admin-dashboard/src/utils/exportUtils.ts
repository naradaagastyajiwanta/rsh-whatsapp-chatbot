import { UserData } from '../types/analytics';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useLanguage } from '../context/LanguageContext';

interface ExportFilters {
  gender?: 'all' | 'male' | 'female';
  healthComplaints?: string[];
  location?: string;
  ageRange?: {
    min?: number;
    max?: number;
  };
}

/**
 * Filter users based on specified criteria
 * @param users Object containing user data
 * @param filters Filters to apply
 * @returns Filtered users object
 */
export const filterUsers = (
  users: { [phone: string]: UserData },
  filters: ExportFilters
): { [phone: string]: UserData } => {
  const filteredUsers: { [phone: string]: UserData } = {};

  Object.entries(users).forEach(([phoneNumber, userData]) => {
    let include = true;

    // Filter by gender
    if (filters.gender && filters.gender !== 'all') {
      if (userData.details.gender !== filters.gender) {
        include = false;
      }
    }

    // Filter by health complaints
    if (filters.healthComplaints && filters.healthComplaints.length > 0 && filters.healthComplaints[0] !== 'all') {
      const userComplaints = userData.details.health_complaints || [];
      // Check if user has at least one of the selected health complaints
      const hasMatchingComplaint = filters.healthComplaints.some(complaint => 
        userComplaints.includes(complaint)
      );
      if (!hasMatchingComplaint) {
        include = false;
      }
    }

    // Filter by province
    if (filters.location && filters.location !== 'all') {
      const userLocation = userData.details.location || '';
      // Extract province from location (assuming format like "City, Province" or just "Province")
      const locationParts = userLocation.split(',');
      const userProvince = locationParts.length > 1 
        ? locationParts[1].trim() 
        : locationParts[0].trim();
      
      // Compare provinces case-insensitive
      if (!userProvince.toLowerCase().includes(filters.location.toLowerCase())) {
        include = false;
      }
    }

    // Filter by age range
    if (filters.ageRange) {
      const userAge = userData.details.age;
      if (userAge !== null) {
        if (filters.ageRange.min !== undefined && userAge < filters.ageRange.min) {
          include = false;
        }
        if (filters.ageRange.max !== undefined && userAge > filters.ageRange.max) {
          include = false;
        }
      } else if (filters.ageRange.min !== undefined || filters.ageRange.max !== undefined) {
        // Exclude users without age if age filter is applied
        include = false;
      }
    }

    if (include) {
      filteredUsers[phoneNumber] = userData;
    }
  });

  return filteredUsers;
};

/**
 * Convert user data to CSV format
 * @param users Filtered users object
 * @returns CSV string
 */
export const convertToCSV = (users: { [phone: string]: UserData }): string => {
  // Define CSV headers
  const headers = [
    'Phone Number',
    'Name',
    'Gender',
    'Age',
    'Location',
    'Health Complaints',
    'Conversion Barriers',
    'First Interaction',
    'Last Interaction'
  ];

  // Create CSV content
  let csvContent = headers.join(',') + '\n';

  Object.entries(users).forEach(([phoneNumber, userData]) => {
    const { details } = userData;
    
    // Format health complaints and conversion barriers as comma-separated values in quotes
    const healthComplaints = details.health_complaints ? 
      `"${details.health_complaints.join(', ')}"` : '""';
    
    const conversionBarriers = details.conversion_barriers ? 
      `"${details.conversion_barriers.join(', ')}"` : '""';
    
    // Format gender for display
    const gender = details.gender === 'male' ? 'Laki-laki' : 
                  details.gender === 'female' ? 'Perempuan' : '';
    
    // Format dates
    const firstInteraction = details.first_interaction ? 
      new Date(details.first_interaction).toLocaleString() : '';
    
    const lastInteraction = details.last_interaction ? 
      new Date(details.last_interaction).toLocaleString() : '';
    
    // Escape fields that might contain commas
    const name = details.name ? `"${details.name}"` : '';
    const location = details.location ? `"${details.location}"` : '';
    
    // Create row
    const row = [
      phoneNumber.replace('@s.whatsapp.net', ''),
      name,
      gender,
      details.age || '',
      location,
      healthComplaints,
      conversionBarriers,
      firstInteraction,
      lastInteraction
    ];
    
    csvContent += row.join(',') + '\n';
  });

  return csvContent;
};

/**
 * Export filtered users data to CSV file
 * @param users Object containing user data
 * @param filters Filters to apply
 * @returns Blob URL for the CSV file
 */
export const exportUsersToCSV = (
  users: { [phone: string]: UserData },
  filters: ExportFilters = {}
): string => {
  // Apply filters
  const filteredUsers = filterUsers(users, filters);
  
  // Convert to CSV
  const csvContent = convertToCSV(filteredUsers);
  
  // Create blob and download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  return url;
};

/**
 * Format date for display in PDF
 * @param dateString ISO date string
 * @returns Formatted date string
 */
const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch (e) {
    return dateString;
  }
};

/**
 * Export filtered users data to PDF file
 * @param users Object containing user data
 * @param filters Filters to apply
 * @param translations Translation function for localization
 * @returns void - triggers PDF download directly
 */
export const exportUsersToPDF = (
  users: { [phone: string]: UserData },
  filters: ExportFilters = {},
  translations: any
): void => {
  // Apply filters
  const filteredUsers = filterUsers(users, filters);
  
  // Create new PDF document
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(18);
  doc.setTextColor(44, 62, 80); // Dark blue-gray color
  doc.text(translations('users.exportTitle') || 'User Data Export', 14, 22);
  
  // Add date
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`${translations('common.exportDate') || 'Export Date'}: ${new Date().toLocaleString()}`, 14, 30);
  
  // Add filter information
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  let filterText = '';
  
  if (filters.gender && filters.gender !== 'all') {
    filterText += `${translations('users.gender') || 'Gender'}: ${filters.gender === 'male' ? 
      translations('users.maleOnly') : translations('users.femaleOnly')}\n`;
  }
  
  if (filters.ageRange) {
    if (filters.ageRange.min !== undefined && filters.ageRange.max !== undefined) {
      filterText += `${translations('users.age') || 'Age'}: ${filters.ageRange.min} - ${filters.ageRange.max}\n`;
    } else if (filters.ageRange.min !== undefined) {
      filterText += `${translations('users.age') || 'Age'}: >= ${filters.ageRange.min}\n`;
    } else if (filters.ageRange.max !== undefined) {
      filterText += `${translations('users.age') || 'Age'}: <= ${filters.ageRange.max}\n`;
    }
  }
  
  if (filters.location && filters.location !== 'all') {
    filterText += `${translations('users.province') || 'Province'}: ${filters.location}\n`;
  }
  
  if (filters.healthComplaints && filters.healthComplaints.length > 0 && filters.healthComplaints[0] !== 'all') {
    filterText += `${translations('users.healthComplaints') || 'Health Complaints'}: ${filters.healthComplaints.join(', ')}\n`;
  }
  
  if (filterText) {
    doc.text(`${translations('users.appliedFilters') || 'Applied Filters'}:\n${filterText}`, 14, 38);
  }
  
  // Prepare table data
  const tableColumn = [
    translations('users.phoneNumber') || 'Phone Number',
    translations('users.name') || 'Name',
    translations('users.gender') || 'Gender',
    translations('users.age') || 'Age',
    translations('users.location') || 'Location',
    translations('users.healthComplaints') || 'Health Complaints',
    translations('users.firstInteraction') || 'First Interaction',
    translations('users.lastInteraction') || 'Last Interaction'
  ];
  
  const tableRows = Object.entries(filteredUsers).map(([phoneNumber, userData]) => {
    const { details } = userData;
    
    // Format gender for display
    const gender = details.gender === 'male' ? translations('users.maleOnly') || 'Male' : 
                  details.gender === 'female' ? translations('users.femaleOnly') || 'Female' : '';
    
    // Format health complaints as comma-separated values
    const healthComplaints = details.health_complaints ? 
      details.health_complaints.join(', ') : '';
    
    return [
      phoneNumber.replace('@s.whatsapp.net', ''),
      details.name || '',
      gender,
      details.age || '',
      details.location || '',
      healthComplaints,
      formatDate(details.first_interaction),
      formatDate(details.last_interaction)
    ];
  });
  
  // Generate table
  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: filterText ? 55 : 40,
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineColor: [44, 62, 80],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [240, 240, 240]
    },
    margin: { top: 20 },
    didDrawPage: (data: any) => {
      // Add page number at the bottom
      doc.setFontSize(8);
      const pageNumber = data.pageNumber;
      doc.text(
        `${translations('common.page') || 'Page'} ${pageNumber}`,
        data.settings.margin.left,
        doc.internal.pageSize.height - 10
      );
    }
  });
  
  // Add total count at the end
  const userCount = Object.keys(filteredUsers).length;
  doc.setFontSize(10);
  doc.setTextColor(44, 62, 80);
  
  // Get the Y position after the table, with a fallback if table wasn't rendered
  // @ts-ignore - previousAutoTable is added by the autotable plugin
  const finalYPosition = doc.lastAutoTable?.finalY || doc.internal.pageSize.height / 2;
  
  doc.text(
    `${translations('users.totalUsers') || 'Total Users'}: ${userCount}`,
    14,
    finalYPosition + 10
  );
  
  // Save the PDF
  doc.save(`user-data-export-${new Date().toISOString().split('T')[0]}.pdf`);
};
