async function handleFormSubmission(formData) {
  const form = FormApp.create(formData.title);
  
  if (formData.type === 'quiz') {
    form.setIsQuiz(true);
    form.setCollectEmail(true);
    form.setLimitOneResponsePerUser(true);
    form.setShowLinkToCopy(false);
    form.setPublishingSummary(true);
    form.setReleaseGrades(FormApp.GradeReleaseOption.IMMEDIATELY);
    form.setAllowResponseEdits(false);
  }

  formData.questions.forEach(question => {
    const lines = question.options || [];
    const questionTitle = question.question;

    if (lines.some(line => /^[A-D]\)/.test(line))) {
      const item = form.addMultipleChoiceItem();
      item.setTitle(questionTitle);

      const correctAnswer = lines.find(line => line.includes('Correct Answer:'));
      const correctLetter = correctAnswer ? correctAnswer.split(':')[1].trim() : null;

      const choices = lines
        .filter(line => /^[A-D]\)/.test(line))
        .map(line => {
          const text = line.replace(/^[A-D]\)\s*/, '').trim();
          return item.createChoice(text, formData.type === 'quiz' && line.startsWith(correctLetter));
        });

      item.setChoices(choices);
      if (formData.type === 'quiz' && correctLetter) {
        item.setPoints(1);
      }
    } else if (lines.some(line => line.includes('- '))) {
      const item = form.addListItem();
      item.setTitle(questionTitle);

      const choices = lines
        .filter(line => line.trim().startsWith('- '))
        .map(line => line.replace(/^-\s*/, '').trim());

      item.setChoiceValues(choices);
    } else if (lines.some(line => line.includes('(Short answer)'))) {
      form.addTextItem().setTitle(questionTitle);
    } else if (lines.some(line => line.includes('(Paragraph)'))) {
      form.addParagraphTextItem().setTitle(questionTitle);
    } else {
      throw new Error(`Unsupported question format for: "${questionTitle}"`);
    }
  });

  return form;
}