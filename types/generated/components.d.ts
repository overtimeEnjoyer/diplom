import type { Schema, Struct } from '@strapi/strapi';

export interface MethodsReflectionQuestions extends Struct.ComponentSchema {
  collectionName: 'components_methods_reflection_questions';
  info: {
    displayName: 'reflection_questions';
    icon: 'alien';
  };
  attributes: {
    text: Schema.Attribute.Text;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'methods.reflection-questions': MethodsReflectionQuestions;
    }
  }
}
