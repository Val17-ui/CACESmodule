
export function getStatusMessageClass(message: string): string {
  const lowerCaseMessage = message.toLowerCase();
  if (lowerCaseMessage.includes("erreur") || lowerCaseMessage.includes("échoué") || lowerCaseMessage.includes("impossible")) {
    return "bg-red-100 text-red-700";
  } else if (lowerCaseMessage.includes("succès") || lowerCaseMessage.includes("réussi")) {
    return "bg-green-100 text-green-700";
  } else {
    return "bg-blue-100 text-blue-700"; // Default or neutral status
  }
}
