const COHERE_API_KEY = 'uJ2ZTTVJOBtP7SVCI22llCYU0EpeKMHmQXpBBQPJ';
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyl1gDHz_LPKQAfCVgnQPn4OZcSuKDpMKkPhhV6jWpcGuDLIud72MHNUGFLODScfbJCcw/exec';

// Default questions per form type
const defaultQuestionsMap = {
    feedback: [
        "Full Name",
        "Email",
        "Overall Experience",
        "What did you like?",
        "What can be improved?"
    ],
    application: [
        "Full Name",
        "Email",
        "Phone",
        "Position Applying For",
        "Cover Letter"
    ],
    contact: [
        "Full Name",
        "Email",
        "Phone",
        "Message Subject",
        "Message"
    ],
    registration: [
        "Full Name",
        "Email",
        "Phone",
        "Birth Date",
        "Address"
    ],
    employment: [
        "Full Name",
        "Email",
        "Phone",
        "Position Desired",
        "Work Experience"
    ],
    membership: [
        "Full Name",
        "Email",
        "Phone",
        "Membership Type",
        "Reason for Joining"
    ],
    educational: [
        "Full Name",
        "Email",
        "Phone",
        "Course/Program",
        "Previous Education"
    ],
    evaluation: [
        "Full Name",
        "Email",
        "Date",
        "Evaluation Criteria",
        "Comments"
    ]
};

const generatePrompt = (topic, formType, count) => {
    // Always follow the user's topic prompt exactly, including any field type or structure instructions.
    // Do NOT add, remove, or change any requirements from the user's topic prompt.
    // If the topic prompt specifies field types, question structure, or any other requirements, follow them strictly.

    // If the user prompt already contains [TYPE: ...] or field type instructions, do not add extra instructions.
    const userHasFieldTypes = /\[TYPE:\s*[A-Z_]+\]/i.test(topic) || /field type|response type|question type/i.test(topic);

    if (userHasFieldTypes) {
        return `Generate exactly ${count} questions for a ${formType} form.
    
    All questions MUST:
    - Be strictly relevant and specific to the topic: "${topic}"
    - Follow the field types, formats, and any other constraints provided in the topic prompt
    - Respect the structure, tone, and detail level expected for this form type
    - Avoid adding, removing, or changing any requirements
    
    Do NOT:
    - Invent unrelated information
    - Reword the topic or instructions
    - Include general knowledge or filler questions`;
    }
    
    const topicInstruction = `Generate exactly ${count} questions for a ${formType} form.
    
    All questions MUST:
    - Be highly relevant and specific to this topic: "${topic}"
    - Use appropriate style, tone, and format expected for the form type
    - Avoid generic, off-topic, or vague questions
    
    Each question should be numbered and on its own line.`;
    

    // Quiz forms remain unchanged
    if (formType === 'quiz') {
        // ...existing quiz logic...
        let promptText = `Create ${count} quiz questions about "${topic}".\n\n${topicInstruction}\n\n`;
        if (topic.toLowerCase().includes('true or false')) {
            promptText += `Generate True/False questions in this EXACT format ONLY:
1. [Question]
A) True
B) False
Answer: [A or B]. [True/False]

Example:
1. JavaScript is a compiled language.
A) True
B) False
Answer: B. False`;
        } else {
            promptText += `Generate multiple choice questions in this EXACT format ONLY:
1. [Question]
A) [Option 1]
B) [Option 2]
C) [Option 3]
D) [Option 4]
Answer: [Letter]. [option text]

Example:
1. What does HTML stand for?
A) Hyper Transfer Markup Language
B) Hyper Text Markup Language
C) High Tech Modern Language
D) Hybrid Text Makeup Language
Answer: B. Hyper Text Markup Language`;
        }
        promptText += `\n\nGenerate exactly ${count} questions following this format strictly.`;
        return promptText;
    } else {
        // Other form types remain the same
        return `Generate ${count} numbered questions for a ${formType} form about "${topic}".
${topicInstruction}
Use a mix of these Google Forms field types: SHORT_ANSWER, PARAGRAPH, MULTIPLE_CHOICE, CHECKBOXES, DROPDOWN, LINEAR_SCALE, DATE, TIME, GRID, CHECKBOX_GRID.
For each question, specify the field type at the start in this format: [TYPE: FIELD_TYPE] Question text
- For MULTIPLE_CHOICE, CHECKBOXES, DROPDOWN: add [OPTIONS: option1, option2, ...] after the question.
- For GRID, CHECKBOX_GRID: add [ROWS: ...] [COLS: ...] after the question.
- For LINEAR_SCALE: add [SCALE: min-max] after the question.
- For SHORT_ANSWER, PARAGRAPH, DATE, TIME: just the question, no options.
Do NOT include any introductory or explanatory text.
Just output the questions, each on its own line, numbered.
Example:
1. [TYPE: SHORT_ANSWER] What is your name?
2. [TYPE: MULTIPLE_CHOICE] How did you hear about us? [OPTIONS: Online, Friend, Advertisement, Other]
3. [TYPE: CHECKBOXES] What did you like? [OPTIONS: Service, Price, Quality, Location]
4. [TYPE: PARAGRAPH] Please provide detailed feedback.
5. [TYPE: LINEAR_SCALE] Rate your overall experience [SCALE: 1-5]
6. [TYPE: DATE] When did you visit?
7. [TYPE: TIME] What time did you arrive?
8. [TYPE: GRID] Rate the following [ROWS: Cleanliness, Staff, Food] [COLS: Poor, Fair, Good, Excellent]
9. [TYPE: CHECKBOX_GRID] Select all that apply [ROWS: Feature A, Feature B] [COLS: Yes, No]
Generate ONLY relevant questions for a ${formType} form.`;
    }
};

async function fetchQuestions(topic, formType, count) {
    showLoadingModal('Generating questions...');
    try {
        const response = await fetch('https://api.cohere.ai/v1/generate', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${COHERE_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                model: 'command',
                prompt: generatePrompt(topic, formType, count),
                max_tokens: 2048,
                temperature: 0.7,
                num_generations: 1
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to generate questions');
        }

        const data = await response.json();
        if (!data.generations || !data.generations[0]) {
            throw new Error('Invalid response from API');
        }

        if (formType !== 'quiz') {
            // Parse [TYPE: FIELD_TYPE] and options for each question
            const allQuestions = data.generations[0].text
                .split(/\n+/)
                .map(line => line.trim())
                .filter(line => line)
                .map(line => {
                    // Match [TYPE: FIELD_TYPE] at start
                    const typeMatch = line.match(/^\d+\.\s*\[TYPE:\s*([A-Z_]+)\]\s*(.*)/i);
                    if (typeMatch) {
                        const fieldType = typeMatch[1].toUpperCase();
                        let title = typeMatch[2];

                        // Extract options if present
                        let options = null, rows = null, cols = null, scale = null;
                        const optionsMatch = title.match(/\[OPTIONS:\s*([^\]]+)\]/i);
                        if (optionsMatch) {
                            options = optionsMatch[1].split(',').map(o => o.trim());
                            title = title.replace(optionsMatch[0], '').trim();
                        }
                        const rowsMatch = title.match(/\[ROWS:\s*([^\]]+)\]/i);
                        const colsMatch = title.match(/\[COLS:\s*([^\]]+)\]/i);
                        if (rowsMatch && colsMatch) {
                            rows = rowsMatch[1].split(',').map(r => r.trim());
                            cols = colsMatch[1].split(',').map(c => c.trim());
                            title = title.replace(rowsMatch[0], '').replace(colsMatch[0], '').trim();
                        }
                        const scaleMatch = title.match(/\[SCALE:\s*(\d+)-(\d+)\]/i);
                        if (scaleMatch) {
                            scale = { min: parseInt(scaleMatch[1]), max: parseInt(scaleMatch[2]) };
                            title = title.replace(scaleMatch[0], '').trim();
                        }

                        return {
                            type: fieldType,
                            title: title,
                            options,
                            rows,
                            cols,
                            scale
                        };
                    } else {
                        // fallback: treat as short answer
                        return {
                            type: "SHORT_ANSWER",
                            title: line.replace(/^\d+\.\s*/, '')
                        };
                    }
                });
            return allQuestions.slice(0, count);
        }

        // For quiz, also ensure exactly 'count' questions
        const quizQuestions = data.generations[0].text
            .split(/(?=\d+\.)/)
            .map(q => q.trim())
            .filter(q => q.match(/^\d+\./));
        return quizQuestions.slice(0, count);
    } catch (error) {
        console.error('Error:', error);
        throw new Error('Failed to generate questions. Please try again.');
    } finally {
        hideLoadingModal();
    }
}

async function createGoogleForm(title, type, questions, email) {
    showLoadingModal('Creating your Google Form...');
    
    try {
        // Validate questions before sending
        if (type === 'quiz') {
            // Check each question for options
            const invalidQuestions = [];
            
            for (let i = 0; i < questions.length; i++) {
                const question = questions[i];
                const options = question.__options || [];
                
                if (!options || options.length === 0) {
                    invalidQuestions.push(i + 1); // Record question number (1-based)
                }
            }
            
            if (invalidQuestions.length > 0) {
                const questionNumbers = invalidQuestions.join(', ');
                hideLoadingModal();
                alert(`Questions #${questionNumbers} have no answer choices. Please regenerate your questions.`);
                throw new Error(`Questions #${questionNumbers} have no choices`);
            }
        }
        
        // Build the questions data
        const formData = {
            title,
            type,
            questions: Array.from(questions).map(li => {
                if (type === 'quiz') {
                    const questionTitle = li.querySelector('.question-title').textContent;
                    const options = Array.from(li.querySelectorAll('.option-item'))
                        .filter(opt => !opt.classList.contains('error'))  // Filter out error messages
                        .map(opt => ({
                            text: opt.textContent.replace(/^[A-D]\)\s*/, '').trim(),
                            isCorrect: opt.classList.contains('correct-option')
                        }));
                    
                    // Additional validation
                    if (!options || options.length === 0) {
                        throw new Error('One or more quiz questions have no choices');
                    }
                    
                    return { title: questionTitle, options };
                } else {
                    // ...existing code for other forms...
                    const questionData = {};
                    questionData.title = li.querySelector('.question-title').textContent;
                    // Get the question object from the preview's dataset (set in displayQuestions)
                    const previewObj = li.__questionObj;
                    if (previewObj) {
                        // Copy all relevant properties for Apps Script
                        questionData.type = previewObj.type;
                        if (previewObj.options) questionData.options = previewObj.options;
                        if (previewObj.rows) questionData.rows = previewObj.rows;
                        if (previewObj.cols) questionData.cols = previewObj.cols;
                        if (previewObj.scale) questionData.scale = previewObj.scale;
                    }
                    return questionData;
                }
            }),
            email
        };
        
        // ...existing fetch and response handling code...
        if (type === 'quiz') {
            const hasEmpty = formData.questions.some(q => !q.options || q.options.length === 0);
            if (hasEmpty) {
                hideLoadingModal();
                alert('One or more quiz questions have no choices. Please regenerate your questions.');
                throw new Error('Quiz question with no choices.');
            }
        }

        // Check for other potential errors before sending
        if (!formData.questions.length) {
            hideLoadingModal();
            alert('No questions to create form with. Please regenerate questions.');
            throw new Error('No questions available.');
        }

        // Log what we're sending to help debug issues
        console.log('Sending to Google Apps Script:', formData);

        const params = new URLSearchParams({
            data: JSON.stringify(formData)
        });

        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            // Check if response is valid JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server returned non-JSON response. Please try again.');
            }

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Failed to create form');
            }

            hideLoadingModal();
            showSuccessModal(result.formUrl, email);
            return result;
        } catch (error) {
            console.error('API Error:', error);
            hideLoadingModal();
            alert(`Failed to create form: ${error.message || 'Unknown error'}. Please try again.`);
            throw error;
        }
    } catch (error) {
        console.error('Form Creation Error:', error);
        hideLoadingModal();
        alert(`Error: ${error.message || 'Unknown error occurred'}`);
        throw error;
    }
}

function showSuccessModal(formUrl, email) {
    const editFormLink = document.getElementById('edit-form-link');
    const successMessage = document.getElementById('success-message');
    
    editFormLink.href = formUrl;
    editFormLink.onclick = (e) => {
        e.preventDefault();
        window.open(formUrl, '_blank');
    };
    
    successMessage.textContent = `Form created and shared with ${email}`;
    document.getElementById('success-modal').classList.remove('hidden');
    document.getElementById('success-modal').classList.add('active');
}

function resetFormContent() {
    document.getElementById('topic').value = '';
    document.getElementById('questionCount').value = '5';
    document.getElementById('question-list').innerHTML = '';
    const placeholder = document.getElementById('placeholder-message');
    const questionList = document.getElementById('question-list');
    const buttonGroup = document.querySelector('.button-group');
    const formLink = document.getElementById('form-link');
    placeholder.style.display = 'block';
    questionList.classList.add('hidden');
    buttonGroup.classList.add('hidden');
    formLink.classList.add('hidden');
    formLink.innerHTML = '';
    questionList.innerHTML = '';
}

// Fix the quiz question parsing and processing to ensure options are properly extracted
function displayQuestions(questions) {
    const questionList = document.getElementById('question-list');
    const placeholder = document.getElementById('placeholder-message');
    const buttonGroup = document.querySelector('.button-group');
    const formType = document.getElementById('formType').value;

    if (!questions || questions.length === 0) {
        placeholder.style.display = 'block';
        questionList.classList.add('hidden');
        buttonGroup.classList.add('hidden');
        return;
    }

    placeholder.style.display = 'none';
    questionList.classList.remove('hidden');
    buttonGroup.classList.remove('hidden');
    questionList.innerHTML = '';

    questions.forEach((question, idx) => {
        const li = document.createElement('li');
        let questionTitle;
        
        if (formType === 'quiz') {
            // Improved parsing for quiz questions with better error handling
            const lines = question.split('\n').map(line => line.trim()).filter(line => line);
            questionTitle = lines[0].replace(/^\d+\.\s*/, '');
            
            // Find options (A, B, C, D) format
            const optionLines = lines.filter(line => /^[A-D]\)/.test(line));
            
            // Find the answer line
            const answerLine = lines.find(line => line.includes('Answer:'));
            
            let correctLetter = '';
            let correctText = '';
            
            if (answerLine) {
                const letterPart = answerLine.split(':')[1]?.trim().charAt(0);
                correctLetter = letterPart;
                // Extract everything after the letter and period
                const textMatch = answerLine.match(/Answer:\s*[A-D]\.?\s*(.*)/);
                if (textMatch && textMatch[1]) {
                    correctText = textMatch[1].trim();
                }
            }
            
            // Generate options HTML with better validation
            let optionsHtml = '<div class="options-list">';
            
            if (optionLines && optionLines.length > 0) {
                optionLines.forEach(line => {
                    const letterMatch = line.match(/^([A-D])\)/);
                    if (!letterMatch) return;
                    
                    const letter = letterMatch[1];
                    const text = line.replace(/^[A-D]\)\s*/, '').trim();
                    const isCorrect = letter === correctLetter;
                    
                    // Store option for form creation
                    if (!li.hasOwnProperty('__options')) {
                        li.__options = [];
                    }
                    li.__options.push({
                        text: text,
                        isCorrect: isCorrect
                    });
                    
                    optionsHtml += `
                        <div class="option-item${isCorrect ? ' correct-option' : ''}">
                            ${text}
                        </div>`;
                });
            } else {
                // If no options found, add placeholder to show the error visually
                optionsHtml += `
                    <div class="option-item error">
                        Error: No choices found for this question.
                    </div>`;
            }
            
            optionsHtml += '</div>';
            
            let correctAnswerHtml = '';
            if (correctText) {
                correctAnswerHtml = `<div class="correct-answer">Answer: ${correctText}</div>`;
            }
            
            li.innerHTML = `
                <div class="question-title">${questionTitle}</div>
                ${optionsHtml}
                ${correctAnswerHtml}
            `;
        } else {
            // ...existing code for other question types...
            questionTitle = question.title;
            let fieldHtml = '';
            switch (question.type) {
                case "SHORT_ANSWER":
                    fieldHtml = `<input type="text" placeholder="Your answer..." disabled style="width: 60%; padding: 8px; border-radius: 6px; border: 1px solid #dfe6e9; margin-top: 8px;">`;
                    break;
                case "PARAGRAPH":
                    fieldHtml = `<textarea placeholder="Your answer..." disabled style="width: 80%; min-height: 60px; padding: 8px; border-radius: 6px; border: 1px solid #dfe6e9; margin-top: 8px;"></textarea>`;
                    break;
                case "MULTIPLE_CHOICE":
                    if (question.options) {
                        fieldHtml = question.options.map(opt =>
                            `<label style="display:block;margin:4px 0;">
                                <input type="radio" disabled name="q${idx}"> ${opt}
                            </label>`
                        ).join('');
                    }
                    break;
                case "CHECKBOXES":
                    if (question.options) {
                        fieldHtml = question.options.map(opt =>
                            `<label style="display:block;margin:4px 0;">
                                <input type="checkbox" disabled name="q${idx}"> ${opt}
                            </label>`
                        ).join('');
                    }
                    break;
                case "DROPDOWN":
                    if (question.options) {
                        fieldHtml = `<select disabled style="width:60%;padding:8px;border-radius:6px;border:1px solid #dfe6e9;margin-top:8px;">
                            <option value="">Select...</option>
                            ${question.options.map(opt => `<option>${opt}</option>`).join('')}
                        </select>`;
                    }
                    break;
                case "LINEAR_SCALE":
                    if (question.scale) {
                        fieldHtml = `<div style="margin-top:8px;">${Array.from({length: question.scale.max - question.scale.min + 1}, (_, i) => {
                            const val = question.scale.min + i;
                            return `<label style="margin-right:10px;"><input type="radio" disabled name="q${idx}"> ${val}</label>`;
                        }).join('')}</div>`;
                    }
                    break;
                case "DATE":
                    fieldHtml = `<input type="date" disabled style="width: 60%; padding: 8px; border-radius: 6px; border: 1px solid #dfe6e9; margin-top: 8px;">`;
                    break;
                case "TIME":
                    fieldHtml = `<input type="time" disabled style="width: 60%; padding: 8px; border-radius: 6px; border: 1px solid #dfe6e9; margin-top: 8px;">`;
                    break;
                case "GRID":
                    if (question.rows && question.cols) {
                        fieldHtml = `<table style="margin-top:8px;border-collapse:collapse;">
                            <tr><th></th>${question.cols.map(col => `<th style="padding:4px 8px;">${col}</th>`).join('')}</tr>
                            ${question.rows.map(row =>
                                `<tr>
                                    <td style="padding:4px 8px;">${row}</td>
                                    ${question.cols.map((col, cidx) =>
                                        `<td style="padding:4px 8px;text-align:center;">
                                            <input type="radio" disabled name="q${idx}_${row}">
                                        </td>`
                                    ).join('')}
                                </tr>`
                            ).join('')}
                        </table>`;
                    }
                    break;
                case "CHECKBOX_GRID":
                    if (question.rows && question.cols) {
                        fieldHtml = `<table style="margin-top:8px;border-collapse:collapse;">
                            <tr><th></th>${question.cols.map(col => `<th style="padding:4px 8px;">${col}</th>`).join('')}</tr>
                            ${question.rows.map(row =>
                                `<tr>
                                    <td style="padding:4px 8px;">${row}</td>
                                    ${question.cols.map((col, cidx) =>
                                        `<td style="padding:4px 8px;text-align:center;">
                                            <input type="checkbox" disabled name="q${idx}_${row}_${col}">
                                        </td>`
                                    ).join('')}
                                </tr>`
                            ).join('')}
                        </table>`;
                    }
                    break;
                default:
                    fieldHtml = `<input type="text" placeholder="Your answer..." disabled style="width: 60%; padding: 8px; border-radius: 6px; border: 1px solid #dfe6e9; margin-top: 8px;">`;
            }
            li.innerHTML = `
                <div class="question-title">${questionTitle}</div>
                <div class="input-preview">${fieldHtml}</div>
            `;
            // Attach the question object for Google Form creation
            li.__questionObj = question;
        }
        
        questionList.appendChild(li);
    });
}

function handlePageTransition(url) {
    const transition = document.querySelector('.page-transition');
    transition.classList.add('active');
    setTimeout(() => {
        window.location.href = url;
    }, 600);
}

document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.querySelector('.hamburger-menu');
    const navLinks = document.querySelector('.nav-links');
    const body = document.body;
    const dropdownBtn = document.querySelector('.nav-dropdown-btn');
    const dropdownContent = document.querySelector('.nav-dropdown-content');

    // Hamburger menu
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navLinks.classList.toggle('active');
            body.classList.toggle('menu-open');
            // Hide dropdown when closing menu
            if (!navLinks.classList.contains('active')) {
                dropdownContent?.classList.remove('show');
                dropdownBtn?.classList.remove('open');
            }
        });
    }

    // Hide "Create Form" nav button in mobile menu
    function hideCreateFormNavButtonOnMobile() {
        const navButton = document.querySelector('.nav-button');
        if (window.innerWidth <= 600) {
            navButton && (navButton.style.display = 'none');
        } else {
            navButton && (navButton.style.display = '');
        }
    }
    hideCreateFormNavButtonOnMobile();
    window.addEventListener('resize', hideCreateFormNavButtonOnMobile);

    // Accordion dropdown for mobile: only show on click, not hover
    if (dropdownBtn && dropdownContent) {
        dropdownBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Toggle accordion
            dropdownContent.classList.toggle('show');
            dropdownBtn.classList.toggle('open');
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-dropdown')) {
            dropdownContent?.classList.remove('show');
            dropdownBtn?.classList.remove('open');
        }
    });

    // Handle menu item clicks (close menu)
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            hamburger?.classList.remove('active');
            navLinks?.classList.remove('active');
            body.classList.remove('menu-open');
            dropdownContent?.classList.remove('show');
            dropdownBtn?.classList.remove('open');
        });
    });

    // --- UNIFIED DROPDOWN HANDLER FOR FORM TYPE NAVIGATION ---
    document.querySelectorAll('.nav-dropdown-content a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const formType = e.target.getAttribute('data-form-type');
            dropdownContent?.classList.remove('show');
            dropdownBtn?.classList.remove('open');
            hamburger?.classList.remove('active');
            navLinks?.classList.remove('active');
            body.classList.remove('menu-open');

            const formTypeSelect = document.getElementById('formType');
            const generatorSection = document.getElementById('generator');
            if (formTypeSelect && generatorSection) {
                formTypeSelect.value = formType;
                if (typeof resetFormContent === 'function') resetFormContent();
                if (typeof showGeneratorPage === 'function') showGeneratorPage();
                setTimeout(() => {
                    generatorSection.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            } else {
                window.location.href = `generator.html#${formType}`;
            }
        });
    });

    // On generator page, auto-select form type if hash is present
    if (window.location.hash && document.getElementById('formType')) {
        const hashType = window.location.hash.replace('#', '');
        const formTypeSelect = document.getElementById('formType');
        if (formTypeSelect.querySelector(`option[value="${hashType}"]`)) {
            formTypeSelect.value = hashType;
            if (typeof resetFormContent === 'function') resetFormContent();
            if (typeof showGeneratorPage === 'function') showGeneratorPage();
            const generatorSection = document.getElementById('generator');
            if (generatorSection) {
                setTimeout(() => {
                    generatorSection.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            }
        }
    }

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const section = document.querySelector(this.getAttribute('href'));
            section?.scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // Page transition for generator.html
    document.querySelectorAll('a[href="generator.html"]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            handlePageTransition('generator.html');
        });
    });

    // Back button in generator page
    const backButton = document.querySelector('a[href="quickform.html"]');
    if (backButton) {
        backButton.addEventListener('click', (e) => {
            e.preventDefault();
            handlePageTransition('quickform.html');
        });
    }

    // Generator logic
    const form = document.getElementById('topic-form');
    if (form) {
        const regenerateButton = document.getElementById('regenerate');
        const createFormButton = document.getElementById('create-form');
        const previewSection = document.getElementById('preview');

        async function handleGeneration(e) {
            if (e) e.preventDefault();
            document.getElementById('question-list').innerHTML = '';
            document.getElementById('form-link').classList.add('hidden');
            document.getElementById('form-link').innerHTML = '';
            const topic = document.getElementById('topic').value.trim();
            const formType = document.getElementById('formType').value;
            const questionCount = parseInt(document.getElementById('questionCount').value) || 5;
            const formLink = document.getElementById('form-link');
            formLink.classList.add('hidden');
            formLink.innerHTML = '';
            if (!topic) {
                alert('Please enter a topic');
                return;
            }
            if (questionCount < 1 || questionCount > 20) {
                alert('Please enter a number between 1 and 20');
                return;
            }
            document.getElementById('loading-text').textContent = 'Generating questions...';
            document.getElementById('loading-modal').classList.remove('hidden');
            try {
                const questions = await fetchQuestions(topic, formType, questionCount);
                displayQuestions(questions);
                previewSection.classList.remove('hidden');
                regenerateButton.classList.remove('hidden');
                createFormButton.classList.remove('hidden');
            } catch (error) {
                alert(error.message);
            } finally {
                document.getElementById('loading-modal').classList.add('hidden');
            }
        }

        form.addEventListener('submit', handleGeneration);
        regenerateButton.addEventListener('click', handleGeneration);

        let emailModalInitialized = false;

        createFormButton.addEventListener('click', () => {
            const questions = document.querySelectorAll('#question-list li');
            if (!questions.length) {
                alert('Please generate questions first');
                return;
            }
            showEmailModal();
            if (!emailModalInitialized) {
                const emailModal = document.getElementById('email-modal');
                const emailInput = document.getElementById('email-input');
                const handleCancel = () => {
                    hideEmailModal();
                    emailInput.value = '';
                };
                const handleSubmit = async () => {
                    const email = emailInput.value.trim();
                    if (!email.endsWith('@gmail.com')) {
                        alert('Please enter a valid Gmail address');
                        return;
                    }
                    hideEmailModal();
                    try {
                        const topic = document.getElementById('topic').value;
                        const formType = document.getElementById('formType').value;
                        const title = `${formType.charAt(0).toUpperCase() + formType.slice(1)} about ${topic}`;
                        await createGoogleForm(title, formType, questions, email);
                    } catch (error) {
                        console.error('Error:', error);
                    }
                };
                emailModal.querySelector('.cancel-button').addEventListener('click', handleCancel);
                emailModal.querySelector('.confirm-button').addEventListener('click', handleSubmit);
                emailInput.addEventListener('keyup', (e) => {
                    if (e.key === 'Enter') handleSubmit();
                    if (e.key === 'Escape') handleCancel();
                });
                emailModalInitialized = true;
            }
        });

        document.getElementById('formType').addEventListener('change', () => {
            resetFormContent();
        });
    }

    const logo = document.querySelector('.logo');
    let lastScrollTop = 0;
    window.addEventListener('scroll', () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        if (scrollTop > lastScrollTop && scrollTop > 50) {
            logo?.classList.add('hide');
        } else {
            logo?.classList.remove('hide');
        }
        lastScrollTop = scrollTop;
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideAllModals();
            }
        });
    });

    document.querySelector('#success-modal .secondary-button')?.addEventListener('click', () => {
        hideSuccessModal();
        window.location.href = 'generator.html';
    });

    document.querySelector('#email-modal .cancel-button').addEventListener('click', () => {
        hideEmailModal();
        document.getElementById('email-input').value = '';
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideAllModals();
        }
    });

    document.getElementById('edit-form-link').addEventListener('click', (e) => {
        const href = e.currentTarget.getAttribute('href');
        if (href && href !== '#') {
            e.preventDefault();
            window.open(href, '_blank', 'noopener');
        }
    });

    const formTypeDropdown = document.getElementById('formTypeDropdown');
    const formTypeSelect = document.getElementById('formType');
    if (formTypeDropdown && formTypeSelect) {
        formTypeSelect.addEventListener('focus', () => {
            formTypeDropdown.classList.add('open');
        });
        formTypeSelect.addEventListener('blur', () => {
            formTypeDropdown.classList.remove('open');
        });
        formTypeSelect.addEventListener('change', () => {
            formTypeDropdown.classList.remove('open');
        });
        document.addEventListener('click', (e) => {
            if (!formTypeDropdown.contains(e.target)) {
                formTypeDropdown.classList.remove('open');
            }
        });
    }
});

function showLoadingModal(message) {
    const loadingModal = document.getElementById('loading-modal');
    const loadingText = document.getElementById('loading-text');
    if (loadingText) loadingText.textContent = message;
    loadingModal.classList.remove('hidden');
    loadingModal.classList.add('active');
}

function hideLoadingModal() {
    const loadingModal = document.getElementById('loading-modal');
    loadingModal.classList.remove('active');
    loadingModal.classList.add('hidden');
}

function showEmailModal() {
    const emailModal = document.getElementById('email-modal');
    emailModal.classList.remove('hidden');
    emailModal.classList.add('active');
}

function hideEmailModal() {
    const emailModal = document.getElementById('email-modal');
    emailModal.classList.remove('active');
    emailModal.classList.add('hidden');
}

function hideSuccessModal() {
    const successModal = document.getElementById('success-modal');
    successModal.classList.remove('active');
    successModal.classList.add('hidden');
}

function hideAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
        modal.classList.add('hidden');
    });
    document.getElementById('email-input').value = '';
}

document.getElementById('success-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        e.target.classList.remove('active');
        e.target.classList.add('hidden');
    }
});

// Fix the "Create Another" button to properly reset the form
document.querySelector('#success-modal .secondary-button').addEventListener('click', () => {
    hideSuccessModal();
    // Complete reset of form and preview
    resetFormContent();
    // Reset select elements and inputs
    document.getElementById('topic').value = '';
    document.getElementById('formType').value = document.getElementById('formType').options[0].value;
    document.getElementById('questionCount').value = '5';
    // Hide the preview completely
    document.getElementById('placeholder-message').style.display = 'block';
    document.getElementById('question-list').classList.add('hidden');
    document.querySelector('.preview-actions').classList.add('hidden');
    // Scroll to top
    window.scrollTo(0, 0);
});

// Improve quiz questions parsing for accurate correct answer identification
function displayQuestions(questions) {
    const questionList = document.getElementById('question-list');
    const placeholder = document.getElementById('placeholder-message');
    const buttonGroup = document.querySelector('.button-group');
    const formType = document.getElementById('formType').value;

    if (!questions || questions.length === 0) {
        placeholder.style.display = 'block';
        questionList.classList.add('hidden');
        buttonGroup.classList.add('hidden');
        return;
    }

    placeholder.style.display = 'none';
    questionList.classList.remove('hidden');
    buttonGroup.classList.remove('hidden');
    questionList.innerHTML = '';

    questions.forEach((question, idx) => {
        const li = document.createElement('li');
        let questionTitle;
        
        if (formType === 'quiz') {
            // Improved quiz question parsing with better regex for answer extraction
            const lines = question.split('\n').map(line => line.trim()).filter(line => line);
            questionTitle = lines[0].replace(/^\d+\.\s*/, '');
            
            const optionLines = lines.filter(line => /^[A-D]\)/.test(line));
            const answerLine = lines.find(line => /Answer:\s*[A-D]/i.test(line));
            
            let correctLetter = '';
            let correctText = '';
            
            if (answerLine) {
                const letterMatch = answerLine.match(/Answer:\s*([A-D])/i);
                correctLetter = letterMatch ? letterMatch[1] : '';
                
                const textMatch = answerLine.match(/Answer:\s*[A-D]\.?\s*(.*)/i);
                correctText = textMatch && textMatch[1] ? textMatch[1].trim() : '';
            }
            
            // Initialize options storage for server
            li.__options = [];
            
            let optionsHtml = '<div class="options-list">';
            
            if (optionLines && optionLines.length > 0) {
                optionLines.forEach(line => {
                    const letterMatch = line.match(/^([A-D])\)/);
                    if (!letterMatch) return;
                    
                    const letter = letterMatch[1];
                    const text = line.replace(/^[A-D]\)\s*/, '').trim();
                    const isCorrect = letter === correctLetter;
                    
                    li.__options.push({
                        text: text,
                        isCorrect: isCorrect
                    });
                    
                    optionsHtml += `
                        <div class="option-item${isCorrect ? ' correct-option' : ''}">
                            ${text}
                        </div>`;
                });
            } else {
                // Add default options for quiz questions without choices
                const defaultOptions = ["Option 1", "Option 2", "Option 3", "Option 4"];
                defaultOptions.forEach((text, i) => {
                    const isCorrect = i === 0; // First option is correct by default
                    li.__options.push({
                        text: text,
                        isCorrect: isCorrect
                    });
                    
                    optionsHtml += `
                        <div class="option-item${isCorrect ? ' correct-option' : ''}">
                            ${text}
                        </div>`;
                });
            }
            
            optionsHtml += '</div>';
            
            let correctAnswerHtml = '';
            if (correctText) {
                correctAnswerHtml = `<div class="correct-answer">Answer: ${correctText}</div>`;
            } else if (li.__options.length > 0) {
                const correctOption = li.__options.find(opt => opt.isCorrect);
                if (correctOption) {
                    correctAnswerHtml = `<div class="correct-answer">Answer: ${correctOption.text}</div>`;
                }
            }
            
            li.innerHTML = `
                <div class="question-title">${questionTitle}</div>
                ${optionsHtml}
                ${correctAnswerHtml}
            `;
        } else {
            // ...existing code for other question types...
            questionTitle = question.title;
            let fieldHtml = '';
            switch (question.type) {
                case "SHORT_ANSWER":
                    fieldHtml = `<input type="text" placeholder="Your answer..." disabled style="width: 60%; padding: 8px; border-radius: 6px; border: 1px solid #dfe6e9; margin-top: 8px;">`;
                    break;
                case "PARAGRAPH":
                    fieldHtml = `<textarea placeholder="Your answer..." disabled style="width: 80%; min-height: 60px; padding: 8px; border-radius: 6px; border: 1px solid #dfe6e9; margin-top: 8px;"></textarea>`;
                    break;
                case "MULTIPLE_CHOICE":
                    if (question.options) {
                        fieldHtml = question.options.map(opt =>
                            `<label style="display:block;margin:4px 0;">
                                <input type="radio" disabled name="q${idx}"> ${opt}
                            </label>`
                        ).join('');
                    }
                    break;
                case "CHECKBOXES":
                    if (question.options) {
                        fieldHtml = question.options.map(opt =>
                            `<label style="display:block;margin:4px 0;">
                                <input type="checkbox" disabled name="q${idx}"> ${opt}
                            </label>`
                        ).join('');
                    }
                    break;
                case "DROPDOWN":
                    if (question.options) {
                        fieldHtml = `<select disabled style="width:60%;padding:8px;border-radius:6px;border:1px solid #dfe6e9;margin-top:8px;">
                            <option value="">Select...</option>
                            ${question.options.map(opt => `<option>${opt}</option>`).join('')}
                        </select>`;
                    }
                    break;
                case "LINEAR_SCALE":
                    if (question.scale) {
                        fieldHtml = `<div style="margin-top:8px;">${Array.from({length: question.scale.max - question.scale.min + 1}, (_, i) => {
                            const val = question.scale.min + i;
                            return `<label style="margin-right:10px;"><input type="radio" disabled name="q${idx}"> ${val}</label>`;
                        }).join('')}</div>`;
                    }
                    break;
                case "DATE":
                    fieldHtml = `<input type="date" disabled style="width: 60%; padding: 8px; border-radius: 6px; border: 1px solid #dfe6e9; margin-top: 8px;">`;
                    break;
                case "TIME":
                    fieldHtml = `<input type="time" disabled style="width: 60%; padding: 8px; border-radius: 6px; border: 1px solid #dfe6e9; margin-top: 8px;">`;
                    break;
                case "GRID":
                    if (question.rows && question.cols) {
                        fieldHtml = `<table style="margin-top:8px;border-collapse:collapse;">
                            <tr><th></th>${question.cols.map(col => `<th style="padding:4px 8px;">${col}</th>`).join('')}</tr>
                            ${question.rows.map(row =>
                                `<tr>
                                    <td style="padding:4px 8px;">${row}</td>
                                    ${question.cols.map((col, cidx) =>
                                        `<td style="padding:4px 8px;text-align:center;">
                                            <input type="radio" disabled name="q${idx}_${row}">
                                        </td>`
                                    ).join('')}
                                </tr>`
                            ).join('')}
                        </table>`;
                    }
                    break;
                case "CHECKBOX_GRID":
                    if (question.rows && question.cols) {
                        fieldHtml = `<table style="margin-top:8px;border-collapse:collapse;">
                            <tr><th></th>${question.cols.map(col => `<th style="padding:4px 8px;">${col}</th>`).join('')}</tr>
                            ${question.rows.map(row =>
                                `<tr>
                                    <td style="padding:4px 8px;">${row}</td>
                                    ${question.cols.map((col, cidx) =>
                                        `<td style="padding:4px 8px;text-align:center;">
                                            <input type="checkbox" disabled name="q${idx}_${row}_${col}">
                                        </td>`
                                    ).join('')}
                                </tr>`
                            ).join('')}
                        </table>`;
                    }
                    break;
                default:
                    fieldHtml = `<input type="text" placeholder="Your answer..." disabled style="width: 60%; padding: 8px; border-radius: 6px; border: 1px solid #dfe6e9; margin-top: 8px;">`;
            }
            li.innerHTML = `
                <div class="question-title">${questionTitle}</div>
                <div class="input-preview">${fieldHtml}</div>
            `;
            // Attach the question object for Google Form creation
            li.__questionObj = question;
        }
        
        questionList.appendChild(li);
    });
}