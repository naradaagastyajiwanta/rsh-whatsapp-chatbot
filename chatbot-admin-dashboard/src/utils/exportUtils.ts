import { UserData } from '../types/analytics';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useLanguage } from '../context/LanguageContext';
import { fetchUserMessages } from '../services/api';
import { format } from 'date-fns';
import { enUS, id as idLocale } from 'date-fns/locale';

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
export const exportUsersToPDF = async (
  users: Record<string, UserData>,
  filters: ExportFilters,
  translations: any
): Promise<void> => {
  // Filter users based on criteria
  const filteredUsers = filterUsers(users, filters);
  
  // Create PDF document in landscape orientation
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });
  
  // Set font
  doc.setFont('helvetica');
  
  // Add title
  doc.setFontSize(16);
  doc.text(translations('users.userDataExport') || 'User Data Export', 14, 20);
  
  // Add export date
  doc.setFontSize(10);
  const currentDate = new Date();
  const dateString = format(currentDate, 'dd MMMM yyyy HH:mm');
  doc.text(`${translations('users.exportDate') || 'Export Date'}: ${dateString}`, 14, 26);
  
  // Add total users count
  const userCount = Object.keys(filteredUsers).length;
  doc.text(`${translations('users.totalUsers') || 'Total Users'}: ${userCount}`, 14, 32);
  
  // Add filter information if any
  let filterText = '';
  if (filters.gender && filters.gender !== 'all') {
    const genderText = filters.gender === 'male' ? 
      (translations('users.maleOnly') || 'Male') : 
      (translations('users.femaleOnly') || 'Female');
    filterText += `${translations('users.gender') || 'Gender'}: ${genderText}\n`;
  }
  
  if (filters.ageRange) {
    const { min, max } = filters.ageRange;
    if (min && max) {
      filterText += `${translations('users.age') || 'Age'}: ${min} - ${max}\n`;
    } else if (min) {
      filterText += `${translations('users.age') || 'Age'}: >= ${min}\n`;
    } else if (max) {
      filterText += `${translations('users.age') || 'Age'}: <= ${max}\n`;
    }
  }
  
  if (filters.location) {
    filterText += `${translations('users.location') || 'Location'}: ${filters.location}\n`;
  }
  
  if (filters.healthComplaints && filters.healthComplaints.length > 0) {
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
    translations('users.conversionBarriers') || 'Conversion Barriers',
    translations('users.userMessages') || 'User Messages'
  ];
  
  // Fetch user messages for all users in parallel
  const userMessagesPromises = Object.entries(filteredUsers).map(async ([phoneNumber, userData]) => {
    try {
      const messages = await fetchUserMessages(phoneNumber);
      return { phoneNumber, messages };
    } catch (error) {
      console.error(`Error fetching messages for ${phoneNumber}:`, error);
      return { phoneNumber, messages: [] };
    }
  });
  
  // Wait for all user messages to be fetched
  const userMessagesResults = await Promise.all(userMessagesPromises);
  
  // Create a map of phone numbers to user messages
  const userMessagesMap = userMessagesResults.reduce((map, { phoneNumber, messages }) => {
    map[phoneNumber] = messages;
    return map;
  }, {} as Record<string, string[]>);
  
  const tableRows = Object.entries(filteredUsers).map(([phoneNumber, userData]) => {
    const { details } = userData;
    
    // Format gender for display
    const gender = details.gender === 'male' ? translations('users.maleOnly') || 'Male' : 
                  details.gender === 'female' ? translations('users.femaleOnly') || 'Female' : '';
    
    // Format health complaints as comma-separated values
    const healthComplaints = details.health_complaints ? 
      details.health_complaints.join(', ') : '';
    
    // Format conversion barriers as comma-separated values
    const conversionBarriers = details.conversion_barriers ? 
      details.conversion_barriers.join(', ') : '';
    
    // Get the user messages from the map
    const messages = userMessagesMap[phoneNumber] || [];
    const userMessages = messages.length > 0 ? 
      messages.join('\n\n') : 
      translations('users.noMessages') || 'No messages';
    
    return [
      phoneNumber.replace('@s.whatsapp.net', ''),
      details.name || '',
      gender,
      details.age || '',
      details.location || '',
      healthComplaints,
      conversionBarriers,
      userMessages // Actual user messages
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
    margin: { top: 20, right: 10, left: 10 },
    columnStyles: {
      // Adjust column widths for landscape orientation
      0: { cellWidth: 25 }, // Phone Number
      1: { cellWidth: 30 }, // Name
      2: { cellWidth: 20 }, // Gender
      3: { cellWidth: 15 }, // Age
      4: { cellWidth: 25 }, // Location
      5: { cellWidth: 40 }, // Health Complaints
      6: { cellWidth: 40 }, // Conversion Barriers
      7: { cellWidth: 'auto' }, // User Messages - auto width for the last column
    },
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
  // Reuse the userCount variable declared earlier
  doc.setFontSize(10);
  doc.setTextColor(44, 62, 80);
  
  // Get the Y position after the table
  // Use a fixed position from the bottom of the page for the total count
  const finalYPosition = doc.internal.pageSize.height - 30;
  
  doc.text(
    `${translations('users.totalUsers') || 'Total Users'}: ${userCount}`,
    14,
    finalYPosition + 10
  );
  
  // Save the PDF
  doc.save(`user-data-export-${new Date().toISOString().split('T')[0]}.pdf`);
};
