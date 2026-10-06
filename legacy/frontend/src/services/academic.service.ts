import api from './api';

export const academicService = {
  getStudentEnrollment: (studentAddress: string, courseId: string, semester: string) =>
    api.get(`/admin/academic/getStudentEnrollment/${studentAddress}/${courseId}/${semester}`),
  getStudentGpa: (studentAddress: string) => api.get(`/admin/academic/getStudentGpa/${studentAddress}`),
  getStudentTotalCredits: (studentAddress: string) =>
    api.get(`/admin/academic/getStudentTotalCredits/${studentAddress}`),
};